const test = require('node:test');
const assert = require('node:assert/strict');
const presets = require('../lib/provider-presets');

const REQUIRED = [
  'agentrouter','openai','anthropic','gemini','openrouter','groq','deepseek',
  'mistral','together','cohere','xai','perplexity','fireworks','cerebras','nvidia-nim',
  'chutes','siliconflow','zai','tabitoken'
];

test('2026 provider library includes major verified and community providers', () => {
  const ids = presets.PROVIDERS.map((p) => p.id);
  for (const id of REQUIRED) assert.ok(ids.includes(id), `missing provider: ${id}`);
});

test('every provider has trust metadata, base URL, auth, and endpoints', () => {
  for (const provider of presets.PROVIDERS) {
    assert.ok(['verified','community'].includes(provider.trust), `bad trust: ${provider.id}`);
    assert.match(provider.baseUrl, /^https:\/\//);
    assert.ok(provider.auth && provider.auth.type);
    assert.ok(Array.isArray(provider.endpoints) && provider.endpoints.length > 0);
    assert.ok(Array.isArray(provider.aliases), `missing aliases: ${provider.id}`);
    if (provider.trust === 'verified') assert.match(provider.verifiedAt, /^2026-09-/);
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

  const chutes = presets.getProvider('chutes');
  assert.equal(chutes.trust, 'verified');
  assert.equal(chutes.baseUrl, 'https://llm.chutes.ai');
  assert.ok(chutes.endpoints.some((e) => e.path === '/v1/chat/completions'));

  const siliconflow = presets.getProvider('siliconflow');
  assert.equal(siliconflow.trust, 'verified');
  assert.ok(siliconflow.endpoints.some((e) => e.path === '/v1/chat/completions'));

  const zai = presets.getProvider('zai');
  assert.equal(zai.trust, 'verified');
  assert.ok(zai.endpoints.some((e) => e.path === '/api/paas/v4/chat/completions'));
});

test('TabiToken is clearly labeled community and has OpenAI plus Anthropic routes', () => {
  const tabi = presets.getProvider('tabitoken');
  assert.equal(tabi.trust, 'community');
  assert.equal(tabi.baseUrl, 'https://tabitoken.com');
  assert.ok(tabi.endpoints.some((e) => e.path === '/v1/chat/completions' && e.format === 'openai_chat'));
  assert.ok(tabi.endpoints.some((e) => e.path === '/v1/messages' && e.format === 'anthropic_messages'));
});

test('provider search matches names, aliases, hosts, and can exclude community entries', () => {
  assert.equal(presets.searchProviders('tabi')[0].id, 'tabitoken');
  assert.ok(presets.searchProviders('claude gateway').some((p) => p.id === 'tabitoken'));
  assert.ok(presets.searchProviders('silicon').some((p) => p.id === 'siliconflow'));
  assert.ok(presets.searchProviders('llm.chutes.ai').some((p) => p.id === 'chutes'));
  assert.equal(presets.searchProviders('tabi', { includeCommunity: false }).length, 0);
});

test('auto setup returns complete endpoint settings for a selected provider', () => {
  const openrouter = presets.getAutoSetup('openrouter', 'chat');
  assert.deepEqual(
    { baseUrl: openrouter.baseUrl, path: openrouter.path, method: openrouter.method, format: openrouter.format, auth: openrouter.auth.type },
    { baseUrl: 'https://openrouter.ai', path: '/api/v1/chat/completions', method: 'POST', format: 'openai_chat', auth: 'bearer' }
  );

  const anthropic = presets.getAutoSetup('anthropic', 'messages');
  assert.equal(anthropic.auth.type, 'x-api-key');
  assert.equal(anthropic.headers['anthropic-version'], '2023-06-01');

  const defaultTabi = presets.getAutoSetup('tabitoken');
  assert.equal(defaultTabi.path, '/v1/chat/completions');
  assert.equal(defaultTabi.trust, 'community');
});

test('resolveEndpointPath substitutes model placeholders safely', () => {
  assert.equal(
    presets.resolveEndpointPath('/v1beta/models/{model}:generateContent', 'gemini-3.8-flash'),
    '/v1beta/models/gemini-3.8-flash:generateContent'
  );
  assert.throws(() => presets.resolveEndpointPath('/v1/{model}', '../private'), /model/i);
});
