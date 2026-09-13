(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ProviderPresets = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const VERIFIED_AT = '2026-09-13';

  function ep(id, label, method, path, format, extra = {}) {
    return { id, label, method, path, format, ...extra };
  }

  const PROVIDERS = [
    {
      id: 'agentrouter', name: 'AgentRouter', baseUrl: 'https://agentrouter.org', verifiedAt: VERIFIED_AT,
      auth: { type: 'bearer' }, docsUrl: 'https://agentrouter.org',
      endpoints: [
        ep('models', 'List Models', 'GET', '/v1/models', 'models'),
        ep('chat', 'OpenAI Chat Completions', 'POST', '/v1/chat/completions', 'openai_chat'),
        ep('messages', 'Anthropic Messages', 'POST', '/v1/messages', 'anthropic_messages', { headers: { 'anthropic-version': '2023-06-01' } })
      ]
    },
    {
      id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com', verifiedAt: VERIFIED_AT,
      auth: { type: 'bearer' }, docsUrl: 'https://developers.openai.com/api/reference/',
      endpoints: [
        ep('models', 'List Models', 'GET', '/v1/models', 'models'),
        ep('responses', 'Responses API', 'POST', '/v1/responses', 'openai_responses'),
        ep('chat', 'Chat Completions', 'POST', '/v1/chat/completions', 'openai_chat')
      ]
    },
    {
      id: 'anthropic', name: 'Anthropic / Claude', baseUrl: 'https://api.anthropic.com', verifiedAt: VERIFIED_AT,
      auth: { type: 'x-api-key' }, docsUrl: 'https://platform.claude.com/docs/en/api/messages',
      headers: { 'anthropic-version': '2023-06-01' },
      endpoints: [
        ep('models', 'List Models', 'GET', '/v1/models', 'models'),
        ep('messages', 'Messages API', 'POST', '/v1/messages', 'anthropic_messages')
      ]
    },
    {
      id: 'gemini', name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com', verifiedAt: VERIFIED_AT,
      auth: { type: 'x-goog-api-key' }, docsUrl: 'https://ai.google.dev/api',
      endpoints: [
        ep('models', 'Native List Models', 'GET', '/v1beta/models', 'models_gemini'),
        ep('generate', 'Native generateContent', 'POST', '/v1beta/models/{model}:generateContent', 'gemini_generate'),
        ep('openai-models', 'OpenAI-compatible List Models', 'GET', '/v1beta/openai/models', 'models', { auth: { type: 'bearer' } }),
        ep('openai-chat', 'OpenAI-compatible Chat', 'POST', '/v1beta/openai/chat/completions', 'openai_chat', { auth: { type: 'bearer' } })
      ]
    },
    {
      id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai', verifiedAt: VERIFIED_AT,
      auth: { type: 'bearer' }, docsUrl: 'https://openrouter.ai/docs/quickstart',
      endpoints: [
        ep('models', 'List Models', 'GET', '/api/v1/models', 'models'),
        ep('chat', 'Chat Completions', 'POST', '/api/v1/chat/completions', 'openai_chat')
      ]
    },
    {
      id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com', verifiedAt: VERIFIED_AT,
      auth: { type: 'bearer' }, docsUrl: 'https://console.groq.com/docs/api-reference',
      endpoints: [
        ep('models', 'List Models', 'GET', '/openai/v1/models', 'models'),
        ep('chat', 'Chat Completions', 'POST', '/openai/v1/chat/completions', 'openai_chat'),
        ep('responses', 'Responses API', 'POST', '/openai/v1/responses', 'openai_responses')
      ]
    },
    {
      id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', verifiedAt: VERIFIED_AT,
      auth: { type: 'bearer' }, docsUrl: 'https://api-docs.deepseek.com/',
      endpoints: [
        ep('models', 'List Models', 'GET', '/models', 'models'),
        ep('chat', 'Chat Completions', 'POST', '/chat/completions', 'openai_chat'),
        ep('responses', 'Responses API', 'POST', '/responses', 'openai_responses')
      ]
    },
    {
      id: 'mistral', name: 'Mistral AI', baseUrl: 'https://api.mistral.ai', verifiedAt: VERIFIED_AT,
      auth: { type: 'bearer' }, docsUrl: 'https://docs.mistral.ai/api',
      endpoints: [
        ep('models', 'List Models', 'GET', '/v1/models', 'models'),
        ep('chat', 'Chat Completions', 'POST', '/v1/chat/completions', 'openai_chat')
      ]
    },
    {
      id: 'together', name: 'Together AI', baseUrl: 'https://api.together.ai', verifiedAt: VERIFIED_AT,
      auth: { type: 'bearer' }, docsUrl: 'https://docs.together.ai/docs/inference/openai-compatibility',
      endpoints: [
        ep('models', 'List Models', 'GET', '/v1/models', 'models'),
        ep('chat', 'Chat Completions', 'POST', '/v1/chat/completions', 'openai_chat')
      ]
    },
    {
      id: 'cohere', name: 'Cohere', baseUrl: 'https://api.cohere.ai', verifiedAt: VERIFIED_AT,
      auth: { type: 'bearer' }, docsUrl: 'https://docs.cohere.com/reference/chat',
      endpoints: [
        ep('models', 'List Models', 'GET', '/v1/models', 'models_cohere'),
        ep('chat', 'Chat v2', 'POST', '/v2/chat', 'cohere_chat')
      ]
    },
    {
      id: 'xai', name: 'xAI', baseUrl: 'https://api.x.ai', verifiedAt: VERIFIED_AT,
      auth: { type: 'bearer' }, docsUrl: 'https://docs.x.ai/developers/rest-api-reference/inference',
      endpoints: [
        ep('models', 'List Models', 'GET', '/v1/models', 'models'),
        ep('responses', 'Responses API', 'POST', '/v1/responses', 'openai_responses'),
        ep('chat', 'Chat Completions', 'POST', '/v1/chat/completions', 'openai_chat')
      ]
    },
    {
      id: 'perplexity', name: 'Perplexity', baseUrl: 'https://api.perplexity.ai', verifiedAt: VERIFIED_AT,
      auth: { type: 'bearer' }, docsUrl: 'https://docs.perplexity.ai/docs/getting-started/quickstart',
      endpoints: [
        ep('models', 'Agent API List Models', 'GET', '/v1/models', 'models', { auth: { type: 'none' } }),
        ep('agent', 'Agent API', 'POST', '/v1/agent', 'openai_responses'),
        ep('responses', 'OpenAI-compatible Responses', 'POST', '/v1/responses', 'openai_responses'),
        ep('chat', 'Sonar Chat Completions', 'POST', '/v1/chat/completions', 'openai_chat')
      ]
    },
    {
      id: 'fireworks', name: 'Fireworks AI', baseUrl: 'https://api.fireworks.ai', verifiedAt: VERIFIED_AT,
      auth: { type: 'bearer' }, docsUrl: 'https://docs.fireworks.ai/guides/querying-text-models',
      endpoints: [
        ep('chat', 'Chat Completions', 'POST', '/inference/v1/chat/completions', 'openai_chat')
      ]
    },
    {
      id: 'cerebras', name: 'Cerebras Inference', baseUrl: 'https://api.cerebras.ai', verifiedAt: VERIFIED_AT,
      auth: { type: 'bearer' }, docsUrl: 'https://inference-docs.cerebras.ai/api-reference/chat-completions',
      endpoints: [
        ep('models', 'List Models', 'GET', '/v1/models', 'models'),
        ep('chat', 'Chat Completions', 'POST', '/v1/chat/completions', 'openai_chat')
      ]
    },
    {
      id: 'nvidia-nim', name: 'NVIDIA API Catalog / NIM', baseUrl: 'https://integrate.api.nvidia.com', verifiedAt: VERIFIED_AT,
      auth: { type: 'bearer' }, docsUrl: 'https://docs.api.nvidia.com/nim/',
      endpoints: [
        ep('chat', 'Hosted Chat Completions', 'POST', '/v1/chat/completions', 'openai_chat')
      ]
    }
  ];

  function getProvider(id) {
    return PROVIDERS.find((provider) => provider.id === String(id || '').trim()) || null;
  }

  function getEndpoint(providerId, endpointId) {
    const provider = getProvider(providerId);
    if (!provider) return null;
    return provider.endpoints.find((endpoint) => endpoint.id === String(endpointId || '').trim()) || null;
  }

  function validateModelForPath(model) {
    const value = String(model || '').trim();
    if (!value || value.length > 256) throw new Error('Model is required for this endpoint');
    if (value.includes('..') || /[\r\n?#]/.test(value)) throw new Error('Invalid model for endpoint path');
    return value;
  }

  function resolveEndpointPath(path, model) {
    const value = String(path || '');
    if (!value.includes('{model}')) return value;
    const safeModel = validateModelForPath(model);
    return value.replaceAll('{model}', encodeURIComponent(safeModel));
  }

  return { VERIFIED_AT, PROVIDERS, getProvider, getEndpoint, resolveEndpointPath, validateModelForPath };
});
