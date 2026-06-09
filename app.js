'use strict';

require('dotenv').config({ quiet: true });

// Demo fixture defaults. Only castle_pk and castle_api_secret need to be set in
// .env; the simulated "valid user" the demo logs in falls back to these values.
const demoDefaults = {
  location: 'localhost',
  valid_username: 'clark.kent@dailyplanet.com',
  valid_name: 'Clark Kent',
  valid_user_id: '00000000',
  valid_password: '1234',
  invalid_password: 'qwerty',
  webhook_url: 'https://webhook.site',
};
for (const [key, value] of Object.entries(demoDefaults)) {
  if (!process.env[key]) process.env[key] = value;
}

const fs = require('fs');
const path = require('path');
const express = require('express');

const {
  ContextPrepareService,
  APIError,
  WebhookVerificationError,
} = require('@castleio/sdk');

const { demos, demoList, validUrls } = require('./demo_config');

// default params rendered with every page
function getDefaultParams() {
  return {
    castle_pk: process.env.castle_pk,
    location: process.env.location || 'localhost',
    demo_list: demoList,
    username: process.env.valid_username,
    invalid_password: process.env.invalid_password,
    valid_password: process.env.valid_password,
    valid_username: process.env.valid_username,
    webhook_url: process.env.webhook_url,
  };
}

function errorResult(err) {
  return { error: err instanceof APIError ? err.message : String(err) };
}

// True for IPv4/IPv6 loopback addresses, including the IPv4-mapped IPv6 form
// Node reports for localhost connections.
function isLoopback(ip) {
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

// Build the Express app around a Castle client. Accepting the client as an
// argument keeps the routes easy to test (the SDK can be stubbed).
function buildApp(castle = require('./castle')) {
  const app = express();

  app.set('views', path.join(__dirname, 'views'));
  app.set('view engine', 'pug');

  // Keep the raw body around so incoming webhooks can be signature-verified
  // (the HMAC is computed over the exact bytes Castle sent).
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use('/static', express.static(path.join(__dirname, 'static')));

  // In-memory store of the most recent webhooks received from Castle. A real
  // app would persist these; an array is plenty for a localhost demo.
  const receivedWebhooks = [];
  let webhookSeq = 0;

  // Serve the Castle browser SDK straight from the npm install (node_modules)
  // instead of vendoring it into the repo. It ends up at /vendor/castle-js/...
  const CASTLE_JS_DIR = path.join(
    __dirname,
    'node_modules',
    '@castleio',
    'castle-js',
    'dist'
  );
  app.use('/vendor/castle-js', express.static(CASTLE_JS_DIR));

  // The post-login /account page is a React app (see ./react). When built, its
  // bundle lives in react/dist and is served from /react-app.
  const REACT_DIST = path.join(__dirname, 'react', 'dist');
  const REACT_ENTRY = '/react-app/assets/account.js';
  const REACT_STYLES = '/react-app/assets/account.css';
  app.use('/react-app', express.static(REACT_DIST));

  // Build the request context (IP, headers, client id) Castle needs from a Node
  // request. Lists/Privacy/Events are account-level and don't need it.
  //
  // The SDK derives the client IP from headers only (X-Forwarded-For, then
  // Remote-Addr). In Node the peer address lives on the socket rather than in a
  // header, so running this demo directly on localhost neither is present and
  // Castle rejects the call with "context[ip] is missing". When the connection
  // is loopback (i.e. local development) expose the socket peer as Remote-Addr
  // so the demo works. In production a proxy sets X-Forwarded-For with the real
  // client IP, so this fallback never applies.
  const buildContext = (req) => {
    const peer = req.socket?.remoteAddress;
    if (
      peer &&
      isLoopback(peer) &&
      !req.headers['x-forwarded-for'] &&
      !req.headers['remote-addr']
    ) {
      req.headers['remote-addr'] = peer;
    }
    return ContextPrepareService.call(req, {}, castle.configuration);
  };

  // a default value reused across the login / password-reset demos
  const registeredAt = '2020-02-23T22:28:55.387Z';

  // -------------------------------------------------------------------------
  // Page routes
  // -------------------------------------------------------------------------

  app.get('/', (_req, res) => {
    res.render('demo', { ...getDefaultParams(), home: true });
  });

  // Post-login account page. Serves a Pug shell that mounts the React app and
  // hands it the publishable key + current user via window.CASTLE_ACCOUNT.
  app.get('/account', (_req, res) => {
    res.render('account', {
      ...getDefaultParams(),
      account: true,
      react_built: fs.existsSync(path.join(REACT_DIST, 'assets', 'account.js')),
      react_js: REACT_ENTRY,
      react_css: REACT_STYLES,
      account_user: {
        id: process.env.valid_user_id || null,
        email: process.env.valid_username || null,
        name: process.env.valid_name || 'Clark Kent',
      },
    });
  });

  // Webhooks demo. The receiver below stores verified payloads; this page lists
  // them. Registered before the catch-all `/:demoName` route so it wins.
  app.get('/webhooks', (req, res) => {
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    res.render('webhooks', {
      ...getDefaultParams(),
      ...demos.webhooks,
      demo_name: 'webhooks',
      webhooks: true,
      webhook_endpoint: `${protocol}://${req.get('host')}/webhooks/castle`,
      webhooks_received: receivedWebhooks,
    });
  });

  // Receives webhooks from Castle. The signature is verified against the raw
  // body; anything that fails verification gets a 404 so we don't reveal the
  // endpoint to unauthenticated callers.
  app.post('/webhooks/castle', (req, res) => {
    try {
      castle.verifyWebhookSignature(
        req.rawBody || Buffer.from(''),
        req.get('X-Castle-Signature')
      );
    } catch (err) {
      if (err instanceof WebhookVerificationError) {
        return res.status(404).render('error', getDefaultParams());
      }
      throw err;
    }

    receivedWebhooks.unshift({
      id: (webhookSeq += 1),
      received_at: new Date().toISOString(),
      body: req.body,
    });
    receivedWebhooks.length = Math.min(receivedWebhooks.length, 50);

    return res.status(204).end();
  });

  app.get('/:demoName', (req, res) => {
    const params = getDefaultParams();
    const { demoName } = req.params;

    if (!validUrls.includes(demoName)) {
      return res.status(404).render('error', params);
    }

    Object.assign(params, demos[demoName], {
      demo_name: demoName,
      [demoName]: true,
    });

    return res.render(demoName, params);
  });

  // -------------------------------------------------------------------------
  // Filter (registration)
  // -------------------------------------------------------------------------

  // A registration is evaluated before the account exists, so it is anonymous
  // activity sent to /filter with the form params (email/phone only). A brand-
  // new email is an attempt; an email that already belongs to a user is a failed
  // registration, resolved to that user via matching_user_id.
  app.post('/evaluate_signup', async (req, res) => {
    const { email, request_token } = req.body;

    const castleType = '$registration';
    const alreadyRegistered = email === process.env.valid_username;
    const castleStatus = alreadyRegistered ? '$failed' : '$attempted';

    const payloadToCastle = {
      type: castleType,
      status: castleStatus,
      params: { email },
      request_token,
      context: buildContext(req),
    };
    if (alreadyRegistered) {
      payloadToCastle.matching_user_id = process.env.valid_user_id;
    }

    let result;
    try {
      result = await castle.filter(payloadToCastle);
    } catch (err) {
      result = errorResult(err);
    }

    const { context, ...echoedPayload } = payloadToCastle;

    res.json({
      api_endpoint: 'filter',
      payload_to_castle: echoedPayload,
      result,
      castle_type: castleType,
      castle_status: castleStatus,
    });
  });

  // -------------------------------------------------------------------------
  // Filter -> Risk (login)
  // -------------------------------------------------------------------------

  // A login reuses one request token across two calls: first Filter the attempt
  // while the visitor is still anonymous, then — on success — assess the
  // authenticated user with Risk. A failed attempt stays on Filter.
  app.post('/evaluate_login', async (req, res) => {
    const { email, password, request_token } = req.body;
    const castleType = '$login';

    const runStep = async (apiEndpoint, castleStatus, fields) => {
      const payloadToCastle = {
        type: castleType,
        status: castleStatus,
        ...fields,
        request_token,
        context: buildContext(req),
      };

      let result;
      try {
        result =
          apiEndpoint === 'risk'
            ? await castle.risk(payloadToCastle)
            : await castle.filter(payloadToCastle);
      } catch (err) {
        result = errorResult(err);
      }

      // context is large and noisy; don't echo it back to the browser.
      const { context, ...echoedPayload } = payloadToCastle;
      return {
        api_endpoint: apiEndpoint,
        payload_to_castle: echoedPayload,
        result,
        castle_type: castleType,
        castle_status: castleStatus,
      };
    };

    // Step 1 — always filter the attempt up front (anonymous -> params).
    const steps = [await runStep('filter', '$attempted', { params: { email } })];

    // Step 2 — the outcome, on the same request token.
    if (
      email === process.env.valid_username &&
      password === process.env.valid_password
    ) {
      steps.push(
        await runStep('risk', '$succeeded', {
          user: {
            id: process.env.valid_user_id,
            email,
            registered_at: registeredAt,
          },
        })
      );
    } else {
      const fields = { params: { email } };
      // A known email with a wrong password resolves to the existing user.
      if (email === process.env.valid_username) {
        fields.matching_user_id = process.env.valid_user_id;
      }
      steps.push(await runStep('filter', '$failed', fields));
    }

    res.json({ steps });
  });

  // -------------------------------------------------------------------------
  // Risk (profile update) — driven by the React /account page
  // -------------------------------------------------------------------------

  app.post('/evaluate_profile_update', async (req, res) => {
    const { name, email, request_token } = req.body;

    const castleType = '$profile_update';
    const castleStatus = '$succeeded';

    const payloadToCastle = {
      type: castleType,
      status: castleStatus,
      user: {
        id: process.env.valid_user_id,
        email: email || process.env.valid_username,
        name,
        registered_at: registeredAt,
      },
      request_token,
      context: buildContext(req),
    };

    // A profile change is a sensitive action, so evaluate it with /risk and act
    // on the verdict (allow / challenge / deny).
    let result;
    try {
      result = await castle.risk(payloadToCastle);
    } catch (err) {
      result = errorResult(err);
    }

    const { context, ...echoedPayload } = payloadToCastle;

    res.json({
      api_endpoint: 'risk',
      payload_to_castle: echoedPayload,
      result,
      castle_type: castleType,
      castle_status: castleStatus,
    });
  });

  // -------------------------------------------------------------------------
  // Log (password reset)
  // -------------------------------------------------------------------------

  app.post('/evaluate_new_password', async (req, res) => {
    const { password, request_token } = req.body;

    // A new password that differs from the current one is a successful reset.
    const castleStatus =
      password === process.env.valid_password ? '$failed' : '$succeeded';
    const castleType = '$password_reset';

    const payloadToCastle = {
      type: castleType,
      status: castleStatus,
      user: {
        id: process.env.valid_user_id,
        email: process.env.valid_username,
        registered_at: registeredAt,
      },
      request_token,
      context: buildContext(req),
    };

    // $password_reset is a good fit for the non-blocking log endpoint: record
    // the event without waiting on a verdict.
    let error;
    try {
      await castle.log(payloadToCastle);
    } catch (err) {
      error = errorResult(err).error;
    }

    const { context, ...echoedPayload } = payloadToCastle;

    res.json({
      api_endpoint: 'log',
      payload_to_castle: echoedPayload,
      result: error ? { error } : { logged: true },
      type: castleType,
      status: castleStatus,
    });
  });

  // Logout is recorded with the non-blocking log endpoint as well.
  app.post('/evaluate_logout', async (req, res) => {
    const { request_token } = req.body;

    const castleType = '$logout';
    const payloadToCastle = {
      type: castleType,
      status: '$succeeded',
      user: {
        id: process.env.valid_user_id,
        email: process.env.valid_username,
      },
      request_token,
      context: buildContext(req),
    };

    let error;
    try {
      await castle.log(payloadToCastle);
    } catch (err) {
      error = errorResult(err).error;
    }

    const { context, ...echoedPayload } = payloadToCastle;

    res.json({
      api_endpoint: 'log',
      payload_to_castle: echoedPayload,
      result: error ? { error } : { logged: true },
      castle_type: castleType,
      castle_status: '$succeeded',
    });
  });

  // -------------------------------------------------------------------------
  // Lists API
  // -------------------------------------------------------------------------

  app.post('/create_list', async (req, res) => {
    const payload = {
      name: req.body.name || 'demo-blocklist',
      color: req.body.color || '$red',
      primary_field: req.body.primary_field || 'user.email',
    };

    let result;
    try {
      const created = await castle.createList(payload);
      const allLists = await castle.fetchAllLists();
      result = { created, all_lists: allLists };
    } catch (err) {
      result = errorResult(err);
    }

    res.json({ api_endpoint: 'lists', payload_to_castle: payload, result });
  });

  // -------------------------------------------------------------------------
  // Privacy API
  // -------------------------------------------------------------------------

  app.post('/privacy_user_data', async (req, res) => {
    const action = req.body.action || 'request';

    const payload = {
      identifier: req.body.identifier || process.env.valid_username,
      identifier_type: req.body.identifier_type || '$email',
    };

    let apiEndpoint;
    let result;
    try {
      if (action === 'delete') {
        apiEndpoint = 'privacy (delete)';
        result = await castle.deleteUserData(payload);
      } else {
        apiEndpoint = 'privacy (request)';
        result = await castle.requestUserData(payload);
      }
    } catch (err) {
      apiEndpoint = 'privacy';
      result = errorResult(err);
    }

    res.json({ api_endpoint: apiEndpoint, payload_to_castle: payload, result });
  });

  return app;
}

// Start the server only when run directly (`node app.js`), not when imported
// by the test suite.
if (require.main === module) {
  // Castle.log is fire-and-forget: it dispatches the request without surfacing
  // the promise, so a failed background log (e.g. bad credentials) would
  // otherwise become an unhandled rejection and crash the process. Log it and
  // keep serving instead.
  process.on('unhandledRejection', (err) => {
    console.error(
      'Unhandled rejection (ignored):',
      err && err.message ? err.message : err
    );
  });

  const port = process.env.PORT || 4006;
  buildApp().listen(port, () => {
    console.log(`Castle Node demo listening on http://localhost:${port}`);
  });
}

module.exports = { buildApp };
