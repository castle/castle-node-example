/**
 * @jest-environment jsdom
 */
'use strict';

const fs = require('fs');
const path = require('path');

// static/app.js is plain browser JS (no module exports). Evaluate it in the
// jsdom global scope so its helpers become callable from the tests, exactly as
// they would be in the browser.
const APP_JS = fs.readFileSync(
  path.join(__dirname, '..', 'static', 'app.js'),
  'utf8'
);

beforeAll(() => {
  // indirect eval runs in global scope, so the function declarations become
  // global bindings (window.renderCastleResponse, etc.).
  window.eval(APP_JS);
});

beforeEach(() => {
  document.body.innerHTML =
    '<div id="results-card" class="hidden"><div id="results"></div></div>';
});

function render(result, apiEndpoint = 'risk') {
  window.renderCastleResponse({
    api_endpoint: apiEndpoint,
    payload_to_castle: { type: '$login' },
    result,
  });
}

describe('verdict banner', () => {
  test('renders a deny verdict with risk score and signals', () => {
    render({
      policy: { action: 'deny' },
      risk: 0.92,
      signals: { bot_behavior: {}, proxy_ip: {} },
    });

    const banner = document.querySelector('.verdict');
    expect(banner).not.toBeNull();
    expect(banner.classList.contains('verdict-deny')).toBe(true);
    expect(banner.querySelector('.verdict-action').textContent).toBe('deny');
    expect(banner.querySelector('.verdict-score').textContent).toContain('0.92');

    const chips = [...document.querySelectorAll('.signals .chip')].map(
      (c) => c.textContent
    );
    expect(chips).toEqual(['bot_behavior', 'proxy_ip']);
  });

  test('renders an allow verdict', () => {
    render({ policy: { action: 'allow' }, risk: 0.05 });

    const banner = document.querySelector('.verdict');
    expect(banner.classList.contains('verdict-allow')).toBe(true);
    expect(banner.querySelector('.verdict-action').textContent).toBe('allow');
  });

  test('reveals the results card', () => {
    render({ policy: { action: 'allow' }, risk: 0.05 });
    expect(
      document.getElementById('results-card').classList.contains('hidden')
    ).toBe(false);
  });

  test('shows no verdict banner for an error result', () => {
    render({ error: 'Responded with 401 code' });
    expect(document.querySelector('.verdict')).toBeNull();
    // the raw JSON response is still shown
    expect(document.querySelector('pre.json')).not.toBeNull();
  });

  test('shows no verdict banner for non-verdict (e.g. lists) responses', () => {
    render({ created: { id: 'list_1' }, all_lists: [] }, 'lists');
    expect(document.querySelector('.verdict')).toBeNull();
  });
});
