'use strict';

// Each demo maps to a route (/<key>) and a Pug template (views/<key>.pug).
const demos = {
  signup: {
    friendly_name: 'sign up',
    blurb: 'Filter a registration ($registration) before the account exists.',
  },
  login: {
    friendly_name: 'login',
    blurb: 'Filter the attempt, then assess a successful login with Risk.',
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
  webhooks: {
    friendly_name: 'webhooks',
    blurb: 'Verify and inspect incoming Castle webhooks.',
  },
};

const demoList = Object.entries(demos).map(([url, demo]) => ({ url, ...demo }));

const validUrls = Object.keys(demos);

module.exports = { demos, demoList, validUrls };
