'use strict';

// Integration tests that exercise the *real* Castle SDK end to end: request
// building (URL, method, auth header, JSON body), response parsing, error
// mapping and failover. Only the network is faked, via the SDK's `overrideFetch`
// hook, so these assert the actual SDK behaviour rather than a stub.

const request = require('supertest');
const {
  Castle,
  FailoverStrategy,
  UnauthorizedError,
  InvalidRequestTokenError,
} = require('@castleio/sdk');
const { buildApp } = require('../app');

const VALID_USERNAME = 'clark.kent@dailyplanet.com';
const VALID_PASSWORD = 'super-secret';
const INVALID_PASSWORD = 'qwerty';
const VALID_USER_ID = '00000000';
const API_SECRET = 'sk_test';
const EXPECTED_AUTH = 'Basic ' + Buffer.from(':' + API_SECRET).toString('base64');

beforeAll(() => {
  process.env.castle_pk = 'pk_test';
  process.env.valid_username = VALID_USERNAME;
  process.env.valid_password = VALID_PASSWORD;
  process.env.invalid_password = INVALID_PASSWORD;
  process.env.valid_user_id = VALID_USER_ID;
});

// A Response-like object matching the minimal contract the SDK relies on
// (`status` + `text()`).
function httpResponse(status, body) {
  return {
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  };
}

function abortError() {
  const err = new Error('The operation was aborted');
  err.name = 'AbortError';
  return err;
}

// Build an overrideFetch that records every call and routes on
// "METHOD /pathname". Handlers receive (url, options) and return a response.
function recordingFetch(routes) {
  const calls = [];
  const fn = async (url, options) => {
    const u = new URL(url);
    const entry = {
      method: options.method,
      pathname: u.pathname,
      href: u.href,
      headers: options.headers,
      body: options.body ? JSON.parse(options.body) : undefined,
    };
    calls.push(entry);

    const handler =
      typeof routes === 'function' ? routes : routes[`${options.method} ${u.pathname}`];
    if (!handler) {
      throw new Error(`Unexpected request: ${options.method} ${u.pathname}`);
    }
    return handler(url, options);
  };
  fn.calls = calls;
  return fn;
}

// A no-op logger keeps the SDK's request/response logging out of the test output.
const silentLogger = { info: () => {} };

function makeCastle(overrideFetch, extra = {}) {
  return new Castle({
    apiSecret: API_SECRET,
    overrideFetch,
    logger: silentLogger,
    ...extra,
  });
}

// Let fire-and-forget work (Castle.log) settle before asserting.
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('risk / filter request building', () => {
  test('a successful login filters the attempt then issues a signed POST /v1/risk', async () => {
    const fetch = recordingFetch({
      'POST /v1/filter': () =>
        httpResponse(200, { policy: { action: 'allow' }, risk: 0.1 }),
      'POST /v1/risk': () =>
        httpResponse(200, {
          policy: { action: 'allow' },
          risk: 0.1,
          signals: { multiple_accounts_per_device: {} },
        }),
    });

    const res = await request(buildApp(makeCastle(fetch)))
      .post('/evaluate_login')
      .set('X-Forwarded-For', '203.0.113.7')
      .set('User-Agent', 'jest-suite')
      .send({ email: VALID_USERNAME, password: VALID_PASSWORD, request_token: 'tok_123' });

    // app-level mapping
    expect(res.status).toBe(200);
    expect(res.body.steps).toHaveLength(2);
    expect(res.body.steps[1].api_endpoint).toBe('risk');
    expect(res.body.steps[1].result.policy.action).toBe('allow');
    expect(res.body.steps[1].result.risk).toBe(0.1);

    // SDK-level requests: Filter the attempt, then Risk the success — reusing
    // the same request token.
    expect(fetch.calls.map((c) => `${c.method} ${c.pathname}`)).toEqual([
      'POST /v1/filter',
      'POST /v1/risk',
    ]);

    const attempt = fetch.calls[0];
    expect(attempt.body).toMatchObject({
      type: '$login',
      status: '$attempted',
      request_token: 'tok_123',
      params: { email: VALID_USERNAME },
    });

    const riskCall = fetch.calls[1];
    expect(riskCall.headers.Authorization).toBe(EXPECTED_AUTH);
    expect(riskCall.headers['Content-Type']).toBe('application/json');
    expect(riskCall.body).toMatchObject({
      type: '$login',
      status: '$succeeded',
      request_token: 'tok_123',
      user: { id: VALID_USER_ID, email: VALID_USERNAME },
    });
    expect(riskCall.body.sent_at).toBeDefined();
    expect(riskCall.body.context).toBeInstanceOf(Object);
    // the client IP from X-Forwarded-For is forwarded in the context
    expect(riskCall.body.context.ip).toBe('203.0.113.7');
  });

  test('a failed login filters the attempt and the failure on POST /v1/filter', async () => {
    const fetch = recordingFetch({
      'POST /v1/filter': () =>
        httpResponse(200, { policy: { action: 'deny' }, risk: 0.97 }),
    });

    const res = await request(buildApp(makeCastle(fetch)))
      .post('/evaluate_login')
      .send({ email: VALID_USERNAME, password: INVALID_PASSWORD, request_token: 'tok' });

    expect(res.body.steps[1].api_endpoint).toBe('filter');
    expect(res.body.steps[1].result.policy.action).toBe('deny');
    expect(fetch.calls.map((c) => c.pathname)).toEqual(['/v1/filter', '/v1/filter']);
    expect(fetch.calls[0].body).toMatchObject({ type: '$login', status: '$attempted' });
    expect(fetch.calls[1].body).toMatchObject({
      type: '$login',
      status: '$failed',
      matching_user_id: VALID_USER_ID,
    });
  });

  test('a new registration POSTs $registration / $attempted to /v1/filter', async () => {
    const fetch = recordingFetch({
      'POST /v1/filter': () => httpResponse(200, { policy: { action: 'allow' }, risk: 0.2 }),
    });

    const res = await request(buildApp(makeCastle(fetch)))
      .post('/evaluate_signup')
      .send({ name: 'Lois Lane', email: 'lois.lane@dailyplanet.com', request_token: 'tok' });

    expect(res.body.api_endpoint).toBe('filter');
    expect(fetch.calls[0].pathname).toBe('/v1/filter');
    expect(fetch.calls[0].body).toMatchObject({
      type: '$registration',
      status: '$attempted',
      request_token: 'tok',
      params: { email: 'lois.lane@dailyplanet.com' },
    });
  });

  test('a profile update POSTs $profile_update to /v1/risk', async () => {
    const fetch = recordingFetch({
      'POST /v1/risk': () => httpResponse(200, { policy: { action: 'allow' }, risk: 0.1 }),
    });

    const res = await request(buildApp(makeCastle(fetch)))
      .post('/evaluate_profile_update')
      .send({ name: 'Kal-El', email: 'kal.el@dailyplanet.com', request_token: 'tok' });

    expect(res.body.api_endpoint).toBe('risk');
    expect(fetch.calls[0].body).toMatchObject({
      type: '$profile_update',
      request_token: 'tok',
      user: { name: 'Kal-El', email: 'kal.el@dailyplanet.com' },
    });
  });
});

describe('error mapping', () => {
  test('the SDK maps a 401 to UnauthorizedError', async () => {
    const castle = makeCastle(recordingFetch(() => httpResponse(401, {})));
    await expect(
      castle.risk({
        type: '$login',
        status: '$succeeded',
        request_token: 'tok',
        user: { id: '1' },
        context: { ip: '1.2.3.4', headers: {} },
      })
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  test('the SDK maps a 422 invalid_request_token to InvalidRequestTokenError', async () => {
    const castle = makeCastle(
      recordingFetch(() => httpResponse(422, { type: 'invalid_request_token' }))
    );
    await expect(
      castle.risk({
        type: '$login',
        status: '$succeeded',
        request_token: 'bad',
        user: { id: '1' },
        context: { ip: '1.2.3.4', headers: {} },
      })
    ).rejects.toBeInstanceOf(InvalidRequestTokenError);
  });

  test('an API error is surfaced through the app without a 500', async () => {
    const res = await request(buildApp(makeCastle(recordingFetch(() => httpResponse(401, {})))))
      .post('/evaluate_login')
      .send({ email: VALID_USERNAME, password: VALID_PASSWORD, request_token: 'tok' });

    expect(res.status).toBe(200);
    expect(res.body.steps[1].result.error).toMatch(/401/);
  });
});

describe('failover', () => {
  test('a request timeout returns the configured failover verdict', async () => {
    const fetch = recordingFetch(() => {
      throw abortError();
    });
    const castle = makeCastle(fetch, { failoverStrategy: FailoverStrategy.deny });

    const res = await request(buildApp(castle))
      .post('/evaluate_login')
      .send({ email: VALID_USERNAME, password: VALID_PASSWORD, request_token: 'tok' });

    expect(res.body.steps[1].api_endpoint).toBe('risk');
    expect(res.body.steps[1].result.failover).toBe(true);
    expect(res.body.steps[1].result.failover_reason).toBe('timeout');
    expect(res.body.steps[1].result.policy.action).toBe('deny');
  });

  test('a 5xx returns a failover verdict (server error)', async () => {
    const fetch = recordingFetch(() => httpResponse(503, {}));
    const castle = makeCastle(fetch, { failoverStrategy: FailoverStrategy.challenge });

    const verdict = await castle.risk({
      type: '$login',
      status: '$succeeded',
      request_token: 'tok',
      user: { id: '1' },
      context: { ip: '1.2.3.4', headers: {} },
    });

    expect(verdict.failover).toBe(true);
    expect(verdict.failover_reason).toBe('server error');
    expect(verdict.policy.action).toBe('challenge');
  });

  test('failoverStrategy "throw" rethrows the underlying error on timeout', async () => {
    const fetch = recordingFetch(() => {
      throw abortError();
    });
    const castle = makeCastle(fetch, { failoverStrategy: FailoverStrategy.throw });

    await expect(
      castle.risk({
        type: '$login',
        status: '$succeeded',
        request_token: 'tok',
        user: { id: '1' },
        context: { ip: '1.2.3.4', headers: {} },
      })
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('log (fire-and-forget)', () => {
  test('password reset POSTs $password_reset to /v1/log', async () => {
    const fetch = recordingFetch({ 'POST /v1/log': () => httpResponse(200, {}) });

    const res = await request(buildApp(makeCastle(fetch)))
      .post('/evaluate_new_password')
      .send({ password: 'a-new-password', request_token: 'tok' });

    expect(res.body.api_endpoint).toBe('log');
    expect(res.body.result).toEqual({ logged: true });

    await flush();
    expect(fetch.calls).toHaveLength(1);
    expect(fetch.calls[0].method).toBe('POST');
    expect(fetch.calls[0].pathname).toBe('/v1/log');
    expect(fetch.calls[0].body).toMatchObject({ type: '$password_reset' });
  });

  test('logout POSTs $logout to /v1/log', async () => {
    const fetch = recordingFetch({ 'POST /v1/log': () => httpResponse(200, {}) });

    const res = await request(buildApp(makeCastle(fetch)))
      .post('/evaluate_logout')
      .send({ request_token: 'tok' });

    expect(res.body.api_endpoint).toBe('log');
    expect(res.body.result).toEqual({ logged: true });

    await flush();
    expect(fetch.calls[0].pathname).toBe('/v1/log');
    expect(fetch.calls[0].body).toMatchObject({ type: '$logout', status: '$succeeded' });
  });
});

describe('Lists API', () => {
  test('create_list POSTs /v1/lists then GETs /v1/lists', async () => {
    const fetch = recordingFetch({
      'POST /v1/lists': () => httpResponse(201, { id: 'list_1', name: 'demo-blocklist' }),
      'GET /v1/lists': () =>
        httpResponse(200, { total_count: 1, data: [{ id: 'list_1' }] }),
    });

    const res = await request(buildApp(makeCastle(fetch)))
      .post('/create_list')
      .send({ name: 'demo-blocklist', color: '$red', primary_field: 'user.email' });

    expect(res.body.result.created).toMatchObject({ id: 'list_1' });
    expect(res.body.result.all_lists).toMatchObject({ total_count: 1 });

    expect(fetch.calls.map((c) => `${c.method} ${c.pathname}`)).toEqual([
      'POST /v1/lists',
      'GET /v1/lists',
    ]);
    expect(fetch.calls[0].body).toMatchObject({
      name: 'demo-blocklist',
      color: '$red',
      primary_field: 'user.email',
    });
    // a GET carries no request body
    expect(fetch.calls[1].body).toBeUndefined();
  });
});

describe('Privacy API', () => {
  test('request user data POSTs /v1/privacy/users', async () => {
    const fetch = recordingFetch({
      'POST /v1/privacy/users': () => httpResponse(200, { status: 'pending' }),
    });

    const res = await request(buildApp(makeCastle(fetch)))
      .post('/privacy_user_data')
      .send({ action: 'request', identifier: VALID_USERNAME, identifier_type: '$email' });

    expect(res.body.api_endpoint).toBe('privacy (request)');
    expect(fetch.calls[0]).toMatchObject({ method: 'POST', pathname: '/v1/privacy/users' });
    expect(fetch.calls[0].body).toMatchObject({
      identifier: VALID_USERNAME,
      identifier_type: '$email',
    });
  });

  test('delete user data DELETEs /v1/privacy/users', async () => {
    const fetch = recordingFetch({
      'DELETE /v1/privacy/users': () => httpResponse(200, { status: 'pending' }),
    });

    const res = await request(buildApp(makeCastle(fetch)))
      .post('/privacy_user_data')
      .send({ action: 'delete', identifier: 'user_42', identifier_type: '$id' });

    expect(res.body.api_endpoint).toBe('privacy (delete)');
    expect(fetch.calls[0]).toMatchObject({ method: 'DELETE', pathname: '/v1/privacy/users' });
  });
});

