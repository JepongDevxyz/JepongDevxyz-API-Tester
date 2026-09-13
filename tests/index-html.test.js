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
    'id="providerSearch"',
    'id="providerSearchResults"',
    'id="providerSelect"',
    'id="providerTrustBadge"',
    'id="autoSetupBtn"',
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

test('frontend exposes provider search, trust labels, and live auto setup behavior', () => {
  assert.match(html, /searchProviders\(/);
  assert.match(html, /getAutoSetup\(/);
  assert.match(html, /\/lib\/auto-setup-core\.js/);
  assert.match(html, /probeProviderSetup\(/);
  assert.match(html, /classifyProbeResult\(/);
  assert.match(html, /chooseProbeModel\(/);
  assert.match(html, /Community/i);
  assert.match(html, /Verified/i);
  assert.match(html, /Auto setup/i);
  assert.match(html, /small real API test/i);
});

test('auto setup button runs the live probe instead of only copying preset fields', () => {
  assert.match(html, /autoSetupBtn'\)\.onclick=probeProviderSetup/);
});

test('frontend references the provider library and safe universal proxy', () => {
  assert.match(html, /\/lib\/provider-presets\.js/);
  assert.match(html, /\/api\/proxy/);
  assert.match(html, /CUSTOM_PROXY_ALLOWLIST/);
});
