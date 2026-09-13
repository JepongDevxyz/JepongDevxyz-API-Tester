const test = require('node:test');
const assert = require('node:assert/strict');
const auto = require('../lib/auto-setup-core');

const provider = {
  id: 'demo',
  endpoints: [
    { id: 'models', format: 'models', default: false },
    { id: 'responses', format: 'openai_responses', default: true },
    { id: 'chat', format: 'openai_chat', default: false },
    { id: 'messages', format: 'anthropic_messages', default: false }
  ]
};

test('probeCandidates excludes model-list endpoints and prioritizes selected endpoint', () => {
  assert.deepEqual(
    auto.probeCandidates(provider, 'messages').map((x) => x.id),
    ['messages', 'responses', 'chat']
  );
});

test('classifyProbeResult recognizes provider-side unauthorized-client blocks without treating them as transport failures', () => {
  const result = auto.classifyProbeResult({
    reachedServer: true,
    ok: false,
    status: 401,
    data: {
      error: { message: 'unauthorized client detected, contact support for assistance' },
      message: 'UNAUTHENTICATED',
      success: false,
      type: 'unauthorized_client_error'
    }
  });
  assert.equal(result.kind, 'client_blocked');
  assert.match(result.message, /client/i);
});

test('chooseProbeModel prefers likely text-generation models over embeddings/audio/image models', () => {
  const ids = [
    'text-embedding-3-small',
    'whisper-large-v3',
    'image-model-v1',
    'llama-3.3-70b-versatile',
    'rerank-v3'
  ];
  assert.equal(auto.chooseProbeModel(ids), 'llama-3.3-70b-versatile');
});

test('classifyProbeResult reports success only for successful provider responses', () => {
  assert.equal(auto.classifyProbeResult({ reachedServer: true, ok: true, status: 200, data: { ok: true } }).kind, 'success');
  assert.equal(auto.classifyProbeResult({ reachedServer: false, ok: false, status: 0, error: 'Failed to fetch' }).kind, 'transport');
});

test('buildEndpointDiscoveryPlan treats a version base URL as a base and probes common API families', () => {
  const plan = auto.buildEndpointDiscoveryPlan('https://myfreeapi.com/v1', { keyPresent: true });
  assert.equal(plan.exact, false);
  assert.equal(plan.baseUrl, 'https://myfreeapi.com/v1');
  assert.ok(plan.models.some((x) => x.url === 'https://myfreeapi.com/v1/models' && x.method === 'GET'));
  assert.ok(plan.requests.some((x) => x.url === 'https://myfreeapi.com/v1/chat/completions' && x.format === 'openai_chat'));
  assert.ok(plan.requests.some((x) => x.url === 'https://myfreeapi.com/v1/responses' && x.format === 'openai_responses'));
  assert.ok(plan.requests.some((x) => x.url === 'https://myfreeapi.com/v1/messages' && x.format === 'anthropic_messages'));
  assert.ok(plan.authModes.includes('none'));
  assert.ok(plan.authModes.includes('bearer'));
  assert.ok(plan.authModes.includes('x-api-key'));
  assert.ok(plan.authModes.includes('x-goog-api-key'));
  assert.equal(plan.authModes.includes('query-key'), false);
});

test('buildEndpointDiscoveryPlan preserves a full request endpoint instead of appending another route', () => {
  const plan = auto.buildEndpointDiscoveryPlan('https://myfreeapi.com/v1/chat/completions', { keyPresent: true });
  assert.equal(plan.exact, true);
  assert.equal(plan.requests.length, 1);
  assert.equal(plan.requests[0].url, 'https://myfreeapi.com/v1/chat/completions');
  assert.equal(plan.requests[0].format, 'openai_chat');
});

test('buildEndpointDiscoveryPlan preserves an arbitrary non-version full endpoint as a generic GET target', () => {
  const plan = auto.buildEndpointDiscoveryPlan('https://myfreeapi.com/v1/status', { keyPresent: false });
  assert.equal(plan.exact, true);
  assert.equal(plan.requests.length, 1);
  assert.equal(plan.requests[0].url, 'https://myfreeapi.com/v1/status');
  assert.equal(plan.requests[0].method, 'GET');
  assert.equal(plan.requests[0].format, 'none');
});

test('Gemini-compatible Google endpoints prefer x-goog-api-key and include native generateContent discovery', () => {
  const plan = auto.buildEndpointDiscoveryPlan('https://generativelanguage.googleapis.com/v1beta', { keyPresent: true });
  assert.equal(plan.authModes[0], 'x-goog-api-key');
  assert.ok(plan.requests.some((x) => x.format === 'gemini_generate' && x.pathTemplate.includes(':generateContent')));
  assert.equal(plan.authModes.includes('query-key'), false);
});

test('route detection treats validation/auth responses as reachable but not a 404', () => {
  assert.equal(auto.isReachableRouteResult({ reachedServer: true, ok: false, status: 400 }), true);
  assert.equal(auto.isReachableRouteResult({ reachedServer: true, ok: false, status: 401 }), true);
  assert.equal(auto.isReachableRouteResult({ reachedServer: true, ok: false, status: 422 }), true);
  assert.equal(auto.isReachableRouteResult({ reachedServer: true, ok: false, status: 404 }), false);
  assert.equal(auto.isReachableRouteResult({ reachedServer: false, ok: false, status: 0 }), false);
});
