'use strict';

// Each demo maps to a route (/<key>) and a Pug template (views/<key>.pug).
const demos = {
  signup: {
    friendly_name: 'sign up',
    blurb: 'Evaluate a registration ($registration) with the risk endpoint.',
  },
  login: {
    friendly_name: 'login',
    blurb: 'Evaluate a login with the risk and filter endpoints.',
    wsd: 'https://www.websequencediagrams.com/files/render?link=Q9WYp8rNThVZhA1inf2FSLfjChYZTdHXyGB9zqvMNpsaAvKvJPARgo5LI5fM5K4D',
  },
  password_reset: {
    friendly_name: 'password reset',
    blurb: 'Record a password-reset event with the non-blocking log endpoint.',
  },
  lists: {
    friendly_name: 'lists',
    blurb: 'Create and fetch lists with the Lists API.',
  },
  privacy: {
    friendly_name: 'privacy',
    blurb: "Request or delete a user's data with the Privacy API.",
  },
};

const demoList = Object.entries(demos).map(([url, demo]) => ({ url, ...demo }));

const validUrls = Object.keys(demos);

module.exports = { demos, demoList, validUrls };
