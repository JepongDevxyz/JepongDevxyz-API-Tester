const test = require('node:test');
const assert = require('node:assert/strict');
const proxy = require('../lib/proxy-core');

test('buildUpstreamRequest creates models GET request', () => {
  const built = proxy.buildUpstreamRequest({ operation: 'models', apiKey: 'sk-test-key' });
  assert.equal(built.url, 'https://agentrouter.org/v1/models');
  assert.equal(built.options.method, 'GET');
  assert.equal(built.options.headers.Authorization, 'Bearer sk-test-key');
});

test('buildUpstreamRequest creates OpenAI chat request', () => {
  const built = proxy.buildUpstreamRequest({ operation: 'chat', apiKey: 'sk-test-key', model: 'deepseek-v4-flash', prompt: 'Reply OK', maxTokens: 32 });
  assert.equal(built.url, 'https://agentrouter.org/v1/chat/completions');
  assert.equal(JSON.parse(built.options.body).model, 'deepseek-v4-flash');
});

test('buildUpstreamRequest creates Anthropic messages request with bearer auth', () => {
  const built = proxy.buildUpstreamRequest({ operation: 'messages', apiKey: 'sk-test-key', model: 'deepseek-v4-flash', prompt: 'Reply OK', authMode: 'bearer', maxTokens: 32 });
  assert.equal(built.url, 'https://agentrouter.org/v1/messages');
  assert.equal(built.options.headers['anthropic-version'], '2023-06-01');
  assert.equal(built.options.headers.Authorization, 'Bearer sk-test-key');
});

test('buildUpstreamRequest supports x-api-key for Anthropic messages', () => {
  const built = proxy.buildUpstreamRequest({ operation: 'messages', apiKey: 'sk-test-key', model: 'claude-opus-4-8', prompt: 'Reply OK', authMode: 'x-api-key' });
  assert.equal(built.options.headers['x-api-key'], 'sk-test-key');
  assert.equal(built.options.headers.Authorization, undefined);
});

test('buildUpstreamRequest rejects unsupported operations', () => {
  assert.throws(() => proxy.buildUpstreamRequest({ operation: 'arbitrary', apiKey: 'sk-test-key' }), /Unsupported operation/);
});

test('buildUpstreamRequest rejects unsafe model identifiers', () => {
  assert.throws(() => proxy.buildUpstreamRequest({ operation: 'chat', apiKey: 'sk-test-key', model: '../../evil', prompt: 'x' }), /Invalid model/);
});
