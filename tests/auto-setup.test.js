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
