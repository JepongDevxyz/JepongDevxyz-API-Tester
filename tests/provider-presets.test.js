const test = require('node:test');
const assert = require('node:assert/strict');
const presets = require('../lib/provider-presets');

const REQUIRED = [
  'agentrouter','openai','anthropic','gemini','openrouter','groq','deepseek',
  'mistral','together','cohere','xai','perplexity','fireworks','cerebras','nvidia-nim'
];

test('verified 2026 provider library includes major providers', () => {
  const ids = presets.PROVIDERS.map((p) => p.id);
  for (const id of REQUIRED) assert.ok(ids.includes(id), `missing provider: ${id}`);
});

test('every verified provider has base URL, verification date, auth, and endpoints', () => {
  for (const provider of presets.PROVIDERS) {
    assert.match(provider.baseUrl, /^https:\/\//);
    assert.match(provider.verifiedAt, /^2026-09-/);
    assert.ok(provider.auth && provider.auth.type);
    assert.ok(Array.isArray(provider.endpoints) && provider.endpoints.length > 0);
  }
});

test('important official endpoint presets are present', () => {
  const openai = presets.getProvider('openai');
  assert.ok(openai.endpoints.some((e) => e.path === '/v1/responses' && e.format === 'openai_responses'));

  const anthropic = presets.getProvider('anthropic');
  assert.equal(anthropic.auth.type, 'x-api-key');
  assert.ok(anthropic.endpoints.some((e) => e.path === '/v1/messages' && e.format === 'anthropic_messages'));

  const gemini = presets.getProvider('gemini');
  assert.ok(gemini.endpoints.some((e) => e.path === '/v1beta/models/{model}:generateContent' && e.format === 'gemini_generate'));

  const groq = presets.getProvider('groq');
  assert.ok(groq.endpoints.some((e) => e.path === '/openai/v1/responses'));

  const perplexity = presets.getProvider('perplexity');
  assert.ok(perplexity.endpoints.some((e) => e.path === '/v1/agent' && e.format === 'openai_responses'));

  const fireworks = presets.getProvider('fireworks');
  assert.ok(fireworks.endpoints.some((e) => e.path === '/inference/v1/chat/completions'));

  const cerebras = presets.getProvider('cerebras');
  assert.ok(cerebras.endpoints.some((e) => e.path === '/v1/models'));

  const xai = presets.getProvider('xai');
  assert.ok(xai.endpoints.some((e) => e.path === '/v1/chat/completions'));
});

test('resolveEndpointPath substitutes model placeholders safely', () => {
  assert.equal(
    presets.resolveEndpointPath('/v1beta/models/{model}:generateContent', 'gemini-3.8-flash'),
    '/v1beta/models/gemini-3.8-flash:generateContent'
  );
  assert.throws(() => presets.resolveEndpointPath('/v1/{model}', '../private'), /model/i);
});
