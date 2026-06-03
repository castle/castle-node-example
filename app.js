'use strict';

require('dotenv').config({ quiet: true });

const path = require('path');
const express = require('express');

const { ContextPrepareService, APIError } = require('@castleio/sdk');

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

// Build the Express app around a Castle client. Accepting the client as an
// argument keeps the routes easy to test (the SDK can be stubbed).
function buildApp(castle = require('./castle')) {
  const app = express();

  app.set('views', path.join(__dirname, 'views'));
  app.set('view engine', 'pug');

  app.use(express.json());
  app.use('/static', express.static(path.join(__dirname, 'static')));

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

  // Build the request context (IP, headers, client id) Castle needs from a Node
  // request. Lists/Privacy/Events are account-level and don't need it.
  const buildContext = (req) =>
    ContextPrepareService.call(req, {}, castle.configuration);

  // a default value reused across the login / password-reset demos
  let registeredAt = '2020-02-23T22:28:55.387Z';

  // -------------------------------------------------------------------------
  // Page routes
  // -------------------------------------------------------------------------

  app.get('/', (_req, res) => {
    res.render('demo', { ...getDefaultParams(), home: true });
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
  // Risk / Filter (login)
  // -------------------------------------------------------------------------

  app.post('/evaluate_login', async (req, res) => {
    const { email, password, request_token } = req.body;

    const castleType = '$login';
    let userId;
    let castleStatus;
    let apiEndpoint;

    // check validity of username + password combo
    if (email === process.env.valid_username) {
      userId = process.env.valid_user_id;

      if (password === process.env.valid_password) {
        castleStatus = '$succeeded';
        apiEndpoint = 'risk';
      } else {
        castleStatus = '$failed';
        apiEndpoint = 'filter';
      }
    } else {
      apiEndpoint = 'filter';
      castleStatus = '$failed';
      userId = null;
      registeredAt = null;
    }

    const payloadToCastle = {
      type: castleType,
      status: castleStatus,
      user: { id: userId, email },
      request_token,
      context: buildContext(req),
    };

    if (registeredAt) {
      payloadToCastle.user.registered_at = registeredAt;
    }

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

    res.json({
      api_endpoint: apiEndpoint,
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

  // -------------------------------------------------------------------------
  // Events API
  // -------------------------------------------------------------------------

  app.post('/events_schema', async (_req, res) => {
    let result;
    try {
      result = await castle.eventsSchema();
    } catch (err) {
      result = errorResult(err);
    }

    res.json({ api_endpoint: 'events/schema', payload_to_castle: {}, result });
  });

  app.post('/query_events', async (req, res) => {
    const payload = {
      filters: [
        {
          field: req.body.field || 'name',
          op: req.body.op || '$eq',
          value: req.body.value || '$login',
        },
      ],
      sort: { field: 'created_at', order: 'desc' },
    };

    let result;
    try {
      result = await castle.queryEvents(payload);
    } catch (err) {
      result = errorResult(err);
    }

    res.json({ api_endpoint: 'events/query', payload_to_castle: payload, result });
  });

  return app;
}

// Start the server only when run directly (`node app.js`), not when imported
// by the test suite.
if (require.main === module) {
  const port = process.env.PORT || 4006;
  buildApp().listen(port, () => {
    console.log(`Castle Node demo listening on http://localhost:${port}`);
  });
}

module.exports = { buildApp };
