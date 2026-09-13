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

test('authentication toggle is present and synchronized with provider/custom auth settings', () => {
  assert.match(html, /id="sendAuth"/);
  assert.match(html, /Send Authentication/i);
  assert.match(html, /syncAuthControls\(/);
  assert.match(html, /sendAuth'\)\.onchange/);
  assert.match(html, /if\(!\$\('sendAuth'\)\.checked\)return\{type:'none'/);
});

test('endpoint-only mode accepts one full HTTPS endpoint and disables preset auth requirements', () => {
  assert.match(html, /id="endpointOnly"/);
  assert.match(html, /Endpoint Only Mode/i);
  assert.match(html, /id="endpointOnlyURL"/);
  assert.match(html, /syncEndpointOnlyMode\(/);
  assert.match(html, /endpointOnly'\)\.onchange/);
  assert.match(html, /endpointOnlyURL/);
  assert.match(html, /customPath:.*endpointOnly/s);
});

test('frontend references the provider library and safe universal proxy', () => {
  assert.match(html, /\/lib\/provider-presets\.js/);
  assert.match(html, /\/api\/proxy/);
  assert.match(html, /CUSTOM_PROXY_ALLOWLIST/);
});
