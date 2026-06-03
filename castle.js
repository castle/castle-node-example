'use strict';

require('dotenv').config();

const { Castle, FailoverStrategy, DEFAULT_ALLOWLIST } = require('@castleio/sdk');

// A single Castle instance carries its own configuration and is reused across
// requests. The API secret comes from the dashboard (Settings → General).
const castle = new Castle({
  apiSecret: process.env.castle_api_secret,

  // Automatic verdict returned by risk/filter when Castle is unreachable or
  // times out: allow (default), deny, or challenge.
  failoverStrategy: FailoverStrategy.deny,

  // Time in ms before the failover strategy kicks in.
  timeout: 1500,

  // Logs Castle API requests and responses (must respond to `info`).
  // logger: console,

  // By default every header except Cookie/Authorization is forwarded, which
  // gives Castle the most signal. Use an allow-list only if you must; the
  // curated DEFAULT_ALLOWLIST is a good starting point.
  allowlisted: DEFAULT_ALLOWLIST,

  // Castle needs the original client IP, not your proxy/load balancer. Pick one
  // of these strategies if X-Forwarded-For alone isn't enough. See the SDK
  // README "Client IP detection" section.
  // ipHeaders: ['Cf-Connecting-Ip'],
  // trustedProxies: [],
  // trustedProxyDepth: 0,
  // trustProxyChain: false,
});

module.exports = castle;
