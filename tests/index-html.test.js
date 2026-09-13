const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('index keeps the approved AI API Tester UI and universal controls', () => {
  for (const marker of [
    'AI API Tester',
    'id="apiKeys"',
    'id="keyList"',
    'id="modelShell"',
    'id="manualModel"',
    'id="usePresets"',
    'id="providerSelect"',
    'id="endpointSelect"',
    'id="transportMode"',
    'id="baseURL"',
    'id="endpointPath"',
    'id="modelsPath"',
    'id="authMode"',
    'id="requestFormat"',
    'id="customBody"',
    'id="testAllBtn"',
    'id="testActiveBtn"'
  ]) assert.ok(html.includes(marker), `missing HTML marker: ${marker}`);
});

test('inline browser JavaScript parses successfully', () => {
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter((source) => source.trim());
  assert.ok(scripts.length > 0, 'expected inline script');
  for (const source of scripts) new vm.Script(source);
});

test('frontend references the verified provider library and safe universal proxy', () => {
  assert.match(html, /\/lib\/provider-presets\.js/);
  assert.match(html, /\/api\/proxy/);
  assert.match(html, /CUSTOM_PROXY_ALLOWLIST/);
});
