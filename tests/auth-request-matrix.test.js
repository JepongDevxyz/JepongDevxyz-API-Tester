const test = require('node:test');
const assert = require('node:assert/strict');
const proxy = require('../lib/proxy-core');
const presets = require('../lib/provider-presets');

function customRequest(overrides = {}) {
  return proxy.buildUpstreamRequest({
    providerId: 'custom',
    apiKey: 'secret-key',
    customBaseUrl: 'https://api.example.com',
    customPath: '/v1/test',
    customMethod: 'GET',
    customFormat: 'none',
    authMode: 'bearer',
    customProxyAllowlist: ['api.example.com'],
    model: 'test-model',
    prompt: 'Reply OK',
    maxTokens: 8,
    ...overrides
  });
}

test('all supported authentication modes are encoded correctly', () => {
  const bearer = customRequest({ authMode: 'bearer' });
  assert.equal(bearer.options.headers.Authorization, 'Bearer secret-key');

  const xApiKey = customRequest({ authMode: 'x-api-key' });
  assert.equal(xApiKey.options.headers['x-api-key'], 'secret-key');

  const google = customRequest({ authMode: 'x-goog-api-key' });
  assert.equal(google.options.headers['x-goog-api-key'], 'secret-key');

  const customHeader = customRequest({
    authMode: 'custom-header',
    customAuthHeader: 'X-Token',
    customAuthPrefix: 'Token'
  });
  assert.equal(customHeader.options.headers['X-Token'], 'Token secret-key');

  const queryKey = customRequest({ authMode: 'query-key', customQueryParam: 'api_key' });
  const queryUrl = new URL(queryKey.url);
  assert.equal(queryUrl.searchParams.get('api_key'), 'secret-key');

  const none = customRequest({ authMode: 'none', disableAuth: true });
  assert.equal(none.options.headers.Authorization, undefined);
  assert.equal(none.options.headers['x-api-key'], undefined);
  assert.equal(none.options.headers['x-goog-api-key'], undefined);
  assert.equal(new URL(none.url).search, '');
});

test('GET never sends a body and POST supports every configured request format', () => {
  const get = customRequest({ customMethod: 'GET', customFormat: 'openai_chat' });
  assert.equal(get.options.method, 'GET');
  assert.equal(get.options.body, undefined);
  assert.equal(get.options.headers['Content-Type'], undefined);

  const cases = [
    ['openai_chat', body => {
      assert.equal(body.model, 'test-model');
      assert.equal(body.messages[0].content, 'Reply OK');
      assert.equal(body.max_tokens, 8);
    }],
    ['openai_responses', body => {
      assert.equal(body.model, 'test-model');
      assert.equal(body.input, 'Reply OK');
      assert.equal(body.max_output_tokens, 8);
    }],
    ['anthropic_messages', body => {
      assert.equal(body.model, 'test-model');
      assert.equal(body.messages[0].content, 'Reply OK');
      assert.equal(body.max_tokens, 8);
    }],
    ['gemini_generate', body => {
      assert.equal(body.contents[0].parts[0].text, 'Reply OK');
      assert.equal(body.generationConfig.maxOutputTokens, 8);
    }],
    ['cohere_chat', body => {
      assert.equal(body.model, 'test-model');
      assert.equal(body.messages[0].content, 'Reply OK');
      assert.equal(body.max_tokens, 8);
    }],
    ['generic_json', body => {
      assert.deepEqual(body, { model: 'test-model', prompt: 'Reply OK', max: '8' });
    }]
  ];

  for (const [format, verify] of cases) {
    const built = customRequest({
      customMethod: 'POST',
      customFormat: format,
      customBody: format === 'generic_json'
        ? '{"model":"{{model}}","prompt":"{{prompt}}","max":"{{max_tokens}}"}'
        : ''
    });
    assert.equal(built.options.method, 'POST', format);
    assert.equal(built.options.headers['Content-Type'], 'application/json', format);
    verify(JSON.parse(built.options.body));
  }

  const noBody = customRequest({ customMethod: 'POST', customFormat: 'none' });
  assert.equal(noBody.options.body, undefined);
});

test('every provider preset endpoint can be built with its declared method and format', () => {
  for (const provider of presets.PROVIDERS) {
    for (const endpoint of provider.endpoints) {
      const auth = endpoint.auth || provider.auth || { type: 'bearer' };
      const input = {
        providerId: provider.id,
        endpointId: endpoint.id,
        apiKey: auth.type === 'none' ? '' : 'dummy-key',
        model: 'test-model',
        prompt: 'Reply OK',
        maxTokens: 8
      };
      const built = proxy.buildUpstreamRequest(input);
      assert.equal(built.options.method, endpoint.method, `${provider.id}/${endpoint.id}`);
      assert.equal(built.format, endpoint.format, `${provider.id}/${endpoint.id}`);
      assert.ok(built.url.startsWith('https://'), `${provider.id}/${endpoint.id}`);
      if (endpoint.method === 'GET') {
        assert.equal(built.options.body, undefined, `${provider.id}/${endpoint.id}`);
      } else if (!String(endpoint.format).startsWith('models') && endpoint.format !== 'none') {
        assert.doesNotThrow(() => JSON.parse(built.options.body), `${provider.id}/${endpoint.id}`);
      }
    }
  }
});

test('endpoint-specific base paths are preserved for Anthropic-compatible routes', () => {
  const deepseek = proxy.buildUpstreamRequest({
    providerId: 'deepseek', endpointId: 'messages', apiKey: 'dummy-key',
    model: 'deepseek-v4-flash', prompt: 'Reply OK', maxTokens: 8
  });
  assert.equal(deepseek.url, 'https://api.deepseek.com/anthropic/v1/messages');
  assert.equal(deepseek.options.headers['x-api-key'], 'dummy-key');

  const fireworks = proxy.buildUpstreamRequest({
    providerId: 'fireworks', endpointId: 'messages', apiKey: 'dummy-key',
    model: 'accounts/fireworks/models/kimi-k2p5', prompt: 'Reply OK', maxTokens: 8
  });
  assert.equal(fireworks.url, 'https://api.fireworks.ai/inference/v1/messages');
  assert.equal(fireworks.options.headers.Authorization, 'Bearer dummy-key');
  assert.equal(fireworks.options.headers['x-api-key'], undefined);

  const zai = proxy.buildUpstreamRequest({
    providerId: 'zai', endpointId: 'messages', apiKey: 'dummy-key',
    model: 'glm-5.1', prompt: 'Reply OK', maxTokens: 8
  });
  assert.equal(zai.url, 'https://api.z.ai/api/anthropic/v1/messages');
  assert.equal(zai.options.headers.Authorization, 'Bearer dummy-key');
});

test('unsupported HTTP methods and malformed keys are rejected before any upstream request is built', () => {
  for (const method of ['PUT', 'PATCH', 'DELETE', 'HEAD']) {
    assert.throws(() => customRequest({ customMethod: method }), /Only GET and POST are supported/);
  }
  assert.throws(() => customRequest({ apiKey: 'bad\nkey' }), /Invalid API key/);
});
