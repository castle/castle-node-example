'use strict';

const request = require('supertest');
const { Castle, APIError } = require('@castleio/sdk');
const { buildApp } = require('../app');

// Non-secret demo identity used across the tests.
const VALID_USERNAME = 'clark.kent@dailyplanet.com';
const VALID_PASSWORD = 'super-secret';
const INVALID_PASSWORD = 'qwerty';
const VALID_USER_ID = '00000000';

beforeAll(() => {
  process.env.castle_pk = 'pk_test';
  process.env.location = 'test';
  process.env.valid_username = VALID_USERNAME;
  process.env.valid_password = VALID_PASSWORD;
  process.env.invalid_password = INVALID_PASSWORD;
  process.env.valid_user_id = VALID_USER_ID;
});

// A real Castle instance (so the request context can be prepared with a real
// configuration) whose network-touching methods are stubbed.
function stubbedCastle(overrides = {}) {
  const castle = new Castle({ apiSecret: 'sk_test' });
  const defaults = {
    risk: { policy: { action: 'allow' }, risk: 0.12, signals: { proxy_ip: {} } },
    filter: { policy: { action: 'deny' }, risk: 0.92, signals: { bot_behavior: {} } },
    log: undefined,
    createList: { id: 'list_1', name: 'demo-blocklist' },
    fetchAllLists: { total_count: 1, data: [{ id: 'list_1' }] },
    requestUserData: { status: 'pending' },
    deleteUserData: { status: 'pending' },
    eventsSchema: { fields: [] },
    queryEvents: { data: [] },
  };
  Object.entries({ ...defaults, ...overrides }).forEach(([method, value]) => {
    jest.spyOn(castle, method).mockResolvedValue(value);
  });
  return castle;
}

describe('page routes', () => {
  let app;
  beforeEach(() => {
    app = buildApp(stubbedCastle());
  });

  test('GET / renders the home page', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Castle workflows demo');
  });

  test('GET /login renders the login demo', async () => {
    const res = await request(app).get('/login');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Log in');
  });

  test.each(['password_reset', 'lists', 'privacy', 'events'])(
    'GET /%s renders',
    async (name) => {
      const res = await request(app).get('/' + name);
      expect(res.status).toBe(200);
    }
  );

  test('unknown route renders the 404 page', async () => {
    const res = await request(app).get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.text).toContain('Page not found');
  });
});

describe('POST /evaluate_login', () => {
  test('valid username + valid password goes to risk', async () => {
    const castle = stubbedCastle();
    const res = await request(buildApp(castle)).post('/evaluate_login').send({
      email: VALID_USERNAME,
      password: VALID_PASSWORD,
      request_token: 'tok',
    });

    expect(res.status).toBe(200);
    expect(res.body.api_endpoint).toBe('risk');
    expect(res.body.castle_status).toBe('$succeeded');
    expect(castle.risk).toHaveBeenCalledTimes(1);
    expect(castle.filter).not.toHaveBeenCalled();
    // context must not be echoed back to the browser
    expect(res.body.payload_to_castle).not.toHaveProperty('context');
    expect(res.body.payload_to_castle.user.id).toBe(VALID_USER_ID);
    expect(res.body.result.policy.action).toBe('allow');
  });

  test('valid username + bad password goes to filter', async () => {
    const castle = stubbedCastle();
    const res = await request(buildApp(castle)).post('/evaluate_login').send({
      email: VALID_USERNAME,
      password: INVALID_PASSWORD,
      request_token: 'tok',
    });

    expect(res.body.api_endpoint).toBe('filter');
    expect(res.body.castle_status).toBe('$failed');
    expect(castle.filter).toHaveBeenCalledTimes(1);
    expect(castle.risk).not.toHaveBeenCalled();
  });

  test('invalid username goes to filter with a null user id', async () => {
    const castle = stubbedCastle();
    const res = await request(buildApp(castle)).post('/evaluate_login').send({
      email: 'someone-else@example.com',
      password: INVALID_PASSWORD,
      request_token: 'tok',
    });

    expect(res.body.api_endpoint).toBe('filter');
    expect(res.body.payload_to_castle.user.id).toBeNull();
  });

  test('surfaces API errors without crashing', async () => {
    const castle = stubbedCastle();
    castle.risk.mockRejectedValue(new APIError('Responded with 401 code'));

    const res = await request(buildApp(castle)).post('/evaluate_login').send({
      email: VALID_USERNAME,
      password: VALID_PASSWORD,
      request_token: 'tok',
    });

    expect(res.status).toBe(200);
    expect(res.body.result.error).toMatch(/401/);
  });
});

describe('POST /evaluate_new_password', () => {
  test('a new (different) password logs $succeeded', async () => {
    const castle = stubbedCastle();
    const res = await request(buildApp(castle))
      .post('/evaluate_new_password')
      .send({ password: 'a-brand-new-password', request_token: 'tok' });

    expect(res.body.api_endpoint).toBe('log');
    expect(res.body.status).toBe('$succeeded');
    expect(res.body.result).toEqual({ logged: true });
    expect(castle.log).toHaveBeenCalledTimes(1);
  });

  test('reusing the valid password logs $failed', async () => {
    const castle = stubbedCastle();
    const res = await request(buildApp(castle))
      .post('/evaluate_new_password')
      .send({ password: VALID_PASSWORD, request_token: 'tok' });

    expect(res.body.status).toBe('$failed');
  });
});

describe('account-level APIs', () => {
  test('POST /create_list creates then fetches all lists', async () => {
    const castle = stubbedCastle();
    const res = await request(buildApp(castle))
      .post('/create_list')
      .send({ name: 'my-list', color: '$green', primary_field: 'ip.address' });

    expect(res.body.api_endpoint).toBe('lists');
    expect(castle.createList).toHaveBeenCalledWith({
      name: 'my-list',
      color: '$green',
      primary_field: 'ip.address',
    });
    expect(castle.fetchAllLists).toHaveBeenCalledTimes(1);
    expect(res.body.result.created).toBeDefined();
    expect(res.body.result.all_lists).toBeDefined();
  });

  test('POST /privacy_user_data defaults to a request', async () => {
    const castle = stubbedCastle();
    const res = await request(buildApp(castle)).post('/privacy_user_data').send({});

    expect(res.body.api_endpoint).toBe('privacy (request)');
    expect(castle.requestUserData).toHaveBeenCalledTimes(1);
    expect(castle.deleteUserData).not.toHaveBeenCalled();
  });

  test('POST /privacy_user_data with action=delete deletes', async () => {
    const castle = stubbedCastle();
    const res = await request(buildApp(castle))
      .post('/privacy_user_data')
      .send({ action: 'delete', identifier: 'user_42', identifier_type: '$id' });

    expect(res.body.api_endpoint).toBe('privacy (delete)');
    expect(castle.deleteUserData).toHaveBeenCalledWith({
      identifier: 'user_42',
      identifier_type: '$id',
    });
  });

  test('POST /events_schema fetches the schema', async () => {
    const castle = stubbedCastle();
    const res = await request(buildApp(castle)).post('/events_schema').send({});

    expect(res.body.api_endpoint).toBe('events/schema');
    expect(castle.eventsSchema).toHaveBeenCalledTimes(1);
  });

  test('POST /query_events builds a filter from the request body', async () => {
    const castle = stubbedCastle();
    const res = await request(buildApp(castle))
      .post('/query_events')
      .send({ field: 'name', op: '$eq', value: '$login' });

    expect(res.body.api_endpoint).toBe('events/query');
    expect(castle.queryEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: [{ field: 'name', op: '$eq', value: '$login' }],
      })
    );
  });

  test('account-level errors are surfaced as result.error', async () => {
    const castle = stubbedCastle();
    castle.createList.mockRejectedValue(new APIError('Responded with 401 code'));

    const res = await request(buildApp(castle)).post('/create_list').send({});

    expect(res.status).toBe(200);
    expect(res.body.result.error).toMatch(/401/);
  });
});
