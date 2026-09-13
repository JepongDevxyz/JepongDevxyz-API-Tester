const test = require('node:test');
const assert = require('node:assert/strict');
const proxy = require('../lib/proxy-core');

test('buildUpstreamRequest creates preset OpenAI models GET request', () => {
  const built = proxy.buildUpstreamRequest({ providerId: 'openai', endpointId: 'models', apiKey: 'sk-test-key' });
  assert.equal(built.url, 'https://api.openai.com/v1/models');
  assert.equal(built.options.method, 'GET');
  assert.equal(built.options.headers.Authorization, 'Bearer sk-test-key');
});

test('buildUpstreamRequest creates DeepSeek chat request', () => {
  const built = proxy.buildUpstreamRequest({ providerId: 'deepseek', endpointId: 'chat', apiKey: 'sk-test-key', model: 'deepseek-v4-flash', prompt: 'Reply OK', maxTokens: 32 });
  assert.equal(built.url, 'https://api.deepseek.com/chat/completions');
  assert.equal(JSON.parse(built.options.body).model, 'deepseek-v4-flash');
});

test('buildUpstreamRequest creates Anthropic messages request with required headers', () => {
  const built = proxy.buildUpstreamRequest({ providerId: 'anthropic', endpointId: 'messages', apiKey: 'sk-test-key', model: 'claude-opus-4-8', prompt: 'Reply OK', maxTokens: 32 });
  assert.equal(built.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(built.options.headers['x-api-key'], 'sk-test-key');
  assert.equal(built.options.headers['anthropic-version'], '2023-06-01');
});

test('buildUpstreamRequest substitutes Gemini model in native generateContent path', () => {
  const built = proxy.buildUpstreamRequest({ providerId: 'gemini', endpointId: 'generate', apiKey: 'AIza-test', model: 'gemini-3.8-flash', prompt: 'Reply OK', maxTokens: 32 });
  assert.equal(built.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');
  assert.equal(built.options.headers['x-goog-api-key'], 'AIza-test');
  assert.equal(JSON.parse(built.options.body).contents[0].parts[0].text, 'Reply OK');
});

test('buildUpstreamRequest supports custom HTTPS endpoints only when proxy host is allowlisted', () => {
  const input = {
    providerId: 'custom',
    apiKey: 'custom-secret',
    customBaseUrl: 'https://api.example.com',
    customPath: '/v1/chat/completions',
    customMethod: 'POST',
    customFormat: 'openai_chat',
    authMode: 'bearer',
    model: 'example-model',
    prompt: 'Hi',
    customProxyAllowlist: ['api.example.com']
  };
  const built = proxy.buildUpstreamRequest(input);
  assert.equal(built.url, 'https://api.example.com/v1/chat/completions');
  assert.equal(built.options.headers.Authorization, 'Bearer custom-secret');
});

test('buildUpstreamRequest rejects custom proxy hosts that are not allowlisted', () => {
  assert.throws(() => proxy.buildUpstreamRequest({
    providerId: 'custom', apiKey: 'x', customBaseUrl: 'https://example.com', customPath: '/api', customMethod: 'GET', customFormat: 'none', customProxyAllowlist: []
  }), /allowlist/i);
});

test('buildUpstreamRequest rejects unsafe custom targets', () => {
  for (const base of ['http://example.com', 'https://localhost:3000', 'https://127.0.0.1', 'https://169.254.169.254']) {
    assert.throws(() => proxy.buildUpstreamRequest({
      providerId: 'custom', apiKey: 'x', customBaseUrl: base, customPath: '/api', customMethod: 'GET', customFormat: 'none', customProxyAllowlist: ['example.com', 'localhost', '127.0.0.1', '169.254.169.254']
    }));
  }
});

test('buildUpstreamRequest does not allow custom headers to override protected transport headers', () => {
  const built = proxy.buildUpstreamRequest({
    providerId: 'custom', apiKey: 'x', customBaseUrl: 'https://api.example.com', customPath: '/api', customMethod: 'POST', customFormat: 'generic_json',
    customProxyAllowlist: ['api.example.com'], authMode: 'none', customHeaders: { Host: 'evil.test', 'Content-Length': '999', 'X-Test': 'ok' }, customBody: '{"hello":"world"}'
  });
  assert.equal(built.options.headers.Host, undefined);
  assert.equal(built.options.headers['Content-Length'], undefined);
  assert.equal(built.options.headers['X-Test'], 'ok');
});
