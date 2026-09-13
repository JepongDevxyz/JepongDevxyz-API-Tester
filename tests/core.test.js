const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../lib/agentrouter-core');

test('parseKeys accepts comma, whitespace, and newlines and deduplicates', () => {
  assert.deepEqual(core.parseKeys('sk-one, sk-two\nsk-one\t sk-three'), ['sk-one', 'sk-two', 'sk-three']);
});

test('maskKey hides the secret while preserving short identifying edges', () => {
  assert.equal(core.maskKey('sk-1234567890abcdef'), 'sk-1234••••••••cdef');
});

test('classifyResponse recognizes unauthorized client provider restriction', () => {
  const result = core.classifyResponse({ reachedServer: true, ok: false, status: 401, data: { error: { message: 'unauthorized client detected' }, type: 'unauthorized_client_error' } });
  assert.equal(result.state, 'client_blocked');
});

test('classifyResponse distinguishes browser transport/CORS failure', () => {
  const result = core.classifyResponse({ reachedServer: false, status: 0, error: 'Failed to fetch' });
  assert.equal(result.state, 'browser_blocked');
});

test('shouldProxyFallback only falls back for browser transport failures', () => {
  assert.equal(core.shouldProxyFallback({ reachedServer: false, status: 0 }), true);
  assert.equal(core.shouldProxyFallback({ reachedServer: true, status: 401, data: { type: 'unauthorized_client_error' } }), false);
});

test('parseModelIds reads OpenAI model list response', () => {
  assert.deepEqual(core.parseModelIds({ data: [{ id: 'deepseek-v4-flash' }, { id: 'gpt-5.6-sol' }] }), ['deepseek-v4-flash', 'gpt-5.6-sol']);
});

test('extractReply supports OpenAI and Anthropic response shapes', () => {
  assert.equal(core.extractReply({ choices: [{ message: { content: 'OPENAI_OK' } }] }), 'OPENAI_OK');
  assert.equal(core.extractReply({ content: [{ type: 'text', text: 'ANTHROPIC_OK' }] }), 'ANTHROPIC_OK');
});
