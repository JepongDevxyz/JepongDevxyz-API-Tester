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
      auth: { type: 'bearer' }, docsUrl: 'https://agentrouter.org', aliases: ['agent router','router','claude router'],
      endpoints: [
        ep('models', 'List Models', 'GET', '/v1/models', 'models'),
        ep('chat', 'OpenAI Chat Completions', 'POST', '/v1/chat/completions', 'openai_chat', { default: true }),
        ep('messages', 'Anthropic Messages', 'POST', '/v1/messages', 'anthropic_messages', { headers: { 'anthropic-version': '2023-06-01' } })
      ]
    },
    {
      id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com', verifiedAt: VERIFIED_AT,
      auth: { type: 'bearer' }, docsUrl: 'https://developers.openai.com/api/reference/', aliases: ['chatgpt','gpt','responses api'],
      endpoints: [
        ep('models', 'List Models', 'GET', '/v1/models', 'models'),
        ep('responses', 'Responses API', 'POST', '/v1/responses', 'openai_responses', { default: true }),
        ep('chat', 'Chat Completions', 'POST', '/v1/chat/completions', 'openai_chat')
      ]
    },
    {
      id: 'anthropic', name: 'Anthropic / Claude', baseUrl: 'https://api.anthropic.com', verifiedAt: VERIFIED_AT,
      auth: { type: 'x-api-key' }, docsUrl: 'https://platform.claude.com/docs/en/api/overview', aliases: ['claude','anthropic messages','claude api'],
      headers: { 'anthropic-version': '2023-06-01' },
      endpoints: [
        ep('models', 'List Models', 'GET', '/v1/models', 'models'),
        ep('messages', 'Messages API', 'POST', '/v1/messages', 'anthropic_messages', { default: true })
      ]
    },
    {
      id: 'gemini', name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com', verifiedAt: VERIFIED_AT,
      auth: { type: 'x-goog-api-key' }, docsUrl: 'https://ai.google.dev/api', aliases: ['google ai','gemini api','generativelanguage'],
      endpoints: [
        ep('models', 'Native List Models', 'GET', '/v1beta/models', 'models_gemini'),
        ep('generate', 'Native generateContent', 'POST', '/v1beta/models/{model}:generateContent', 'gemini_generate', { default: true }),
        ep('openai-models', 'OpenAI-compatible List Models', 'GET', '/v1beta/openai/models', 'models', { auth: { type: 'bearer' } }),
        ep('openai-chat', 'OpenAI-compatible Chat', 'POST', '/v1beta/openai/chat/completions', 'openai_chat', { auth: { type: 'bearer' } })
      ]
    },
    {
      id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai', verifiedAt: VERIFIED_AT,
      auth: { type: 'bearer' }, docsUrl: 'https://openrouter.ai/docs/quickstart', aliases: ['open router','multi model router'],
      endpoints: [
        ep('models', 'List Models', 'GET', '/api/v1/models', 'models'),
        ep('chat', 'Chat Completions', 'POST', '/api/v1/chat/completions', 'openai_chat', { default: true }),
        ep('responses', 'Responses API', 'POST', '/api/v1/responses', 'openai_responses'),
        ep('messages', 'Anthropic Messages', 'POST', '/api/v1/messages', 'anthropic_messages', { headers: { 'anthropic-version': '2023-06-01' } })
      ]
    },
    {
      id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com', verifiedAt: VERIFIED_AT,
      auth: { type: 'bearer' }, docsUrl: 'https://console.groq.com/docs/api-reference', aliases: ['groqcloud','groq cloud'],
      endpoints: [
        ep('models', 'List Models', 'GET', '/openai/v1/models', 'models'),
        ep('chat', 'Chat Completions', 'POST', '/openai/v1/chat/completions', 'openai_chat', { default: true }),
        ep('responses', 'Responses API', 'POST', '/openai/v1/responses', 'openai_responses')
      ]
    },
    {
      id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', verifiedAt: VERIFIED_AT,
      auth: { type: 'bearer' }, docsUrl: 'https://api-docs.deepseek.com/', aliases: ['deep seek'],
      endpoints: [
        ep('models', 'List Models', 'GET', '/models', 'models'),
        ep('chat', 'Chat Completions', 'POST', '/chat/completions', 'openai_chat', { default: true }),
        ep('responses', 'Responses API', 'POST', '/responses', 'openai_responses'),
        ep('messages', 'Anthropic Messages', 'POST', '/v1/messages', 'anthropic_messages', {
          baseUrl: 'https://api.deepseek.com/anthropic', auth: { type: 'x-api-key' }, headers: { 'anthropic-version': '2023-06-01' }
        })
      ]
    },
    {
      id: 'mistral', name: 'Mistral AI', baseUrl: 'https://api.mistral.ai', verifiedAt: VERIFIED_AT,
      auth: { type: 'bearer' }, docsUrl: 'https://docs.mistral.ai/api', aliases: ['mistral'],
      endpoints: [
        ep('models', 'List Models', 'GET', '/v1/models', 'models'),
        ep('chat', 'Chat Completions', 'POST', '/v1/chat/completions', 'openai_chat', { default: true })
      ]
    },
    {
      id: 'together', name: 'Together AI', baseUrl: 'https://api.together.ai', verifiedAt: VERIFIED_AT,
      auth: { type: 'bearer' }, docsUrl: 'https://docs.together.ai/docs/inference/openai-compatibility', aliases: ['together','togetherai'],
      endpoints: [
        ep('models', 'List Models', 'GET', '/v1/models', 'models'),
        ep('chat', 'Chat Completions', 'POST', '/v1/chat/completions', 'openai_chat', { default: true })
      ]
    },
    {
      id: 'cohere', name: 'Cohere', baseUrl: 'https://api.cohere.ai', verifiedAt: VERIFIED_AT,
      auth: { type: 'bearer' }, docsUrl: 'https://docs.cohere.com/reference/chat', aliases: ['command r','command'],
      endpoints: [
        ep('models', 'List Models', 'GET', '/v1/models', 'models_cohere'),
        ep('chat', 'Chat v2', 'POST', '/v2/chat', 'cohere_chat', { default: true })
      ]
    },
    {
      id: 'xai', name: 'xAI', baseUrl: 'https://api.x.ai', verifiedAt: VERIFIED_AT,
      auth: { type: 'bearer' }, docsUrl: 'https://docs.x.ai/developers/rest-api-reference/inference', aliases: ['grok','x ai'],
      endpoints: [
        ep('models', 'List Models', 'GET', '/v1/models', 'models'),
        ep('responses', 'Responses API', 'POST', '/v1/responses', 'openai_responses'),
        ep('chat', 'Chat Completions', 'POST', '/v1/chat/completions', 'openai_chat', { default: true })
      ]
    },
    {
      id: 'perplexity', name: 'Perplexity', baseUrl: 'https://api.perplexity.ai', verifiedAt: VERIFIED_AT,
      auth: { type: 'bearer' }, docsUrl: 'https://docs.perplexity.ai/docs/agent-api/quickstart', aliases: ['sonar','perplexity sonar'],
      endpoints: [
        ep('models', 'Agent API List Models', 'GET', '/v1/models', 'models', { auth: { type: 'none' } }),
        ep('agent', 'Agent API', 'POST', '/v1/agent', 'openai_responses'),
        ep('responses', 'OpenAI-compatible Responses', 'POST', '/v1/responses', 'openai_responses'),
        ep('chat', 'Sonar Chat Completions', 'POST', '/v1/chat/completions', 'openai_chat', { default: true })
      ]
    },
    {
      id: 'fireworks', name: 'Fireworks AI', baseUrl: 'https://api.fireworks.ai', verifiedAt: VERIFIED_AT,
      auth: { type: 'bearer' }, docsUrl: 'https://docs.fireworks.ai/getting-started/quickstart', aliases: ['fireworks'],
      endpoints: [
        ep('chat', 'Chat Completions', 'POST', '/inference/v1/chat/completions', 'openai_chat', { default: true }),
        ep('messages', 'Anthropic Messages', 'POST', '/v1/messages', 'anthropic_messages', {
          baseUrl: 'https://api.fireworks.ai/inference', auth: { type: 'bearer' }, headers: { 'anthropic-version': '2023-06-01' }
        })
      ]
    },
    {
      id: 'cerebras', name: 'Cerebras Inference', baseUrl: 'https://api.cerebras.ai', verifiedAt: VERIFIED_AT,
      auth: { type: 'bearer' }, docsUrl: 'https://inference-docs.cerebras.ai/api-reference/authentication', aliases: ['cerebras'],
      endpoints: [
        ep('models', 'List Models', 'GET', '/v1/models', 'models'),
        ep('chat', 'Chat Completions', 'POST', '/v1/chat/completions', 'openai_chat', { default: true })
      ]
    },
    {
      id: 'nvidia-nim', name: 'NVIDIA API Catalog / NIM', baseUrl: 'https://integrate.api.nvidia.com', verifiedAt: VERIFIED_AT,
      auth: { type: 'bearer' }, docsUrl: 'https://docs.api.nvidia.com/nim/re/reference/llm-apis', aliases: ['nvidia','nim','nvidia api catalog'],
      endpoints: [
        ep('chat', 'Hosted Chat Completions', 'POST', '/v1/chat/completions', 'openai_chat', { default: true })
      ]
    },
    {
      id: 'chutes', name: 'Chutes', baseUrl: 'https://llm.chutes.ai', verifiedAt: VERIFIED_AT,
      auth: { type: 'bearer' }, docsUrl: 'https://chutes.ai/docs/guides/starter-guide', aliases: ['chutes ai','llm.chutes.ai','bittensor chutes'],
      endpoints: [
        ep('models', 'List Models', 'GET', '/v1/models', 'models'),
        ep('chat', 'OpenAI Chat Completions', 'POST', '/v1/chat/completions', 'openai_chat', { default: true })
      ]
    },
    {
      id: 'siliconflow', name: 'SiliconFlow', baseUrl: 'https://api.siliconflow.com', verifiedAt: VERIFIED_AT,
      auth: { type: 'bearer' }, docsUrl: 'https://docs.siliconflow.com/en/api-reference/models/get-model-list', aliases: ['silicon flow','siliconcloud','silicon cloud'],
      endpoints: [
        ep('models', 'List Models', 'GET', '/v1/models', 'models'),
        ep('chat', 'OpenAI-compatible Chat', 'POST', '/v1/chat/completions', 'openai_chat', { default: true })
      ]
    },
    {
      id: 'zai', name: 'Z.AI / GLM', baseUrl: 'https://api.z.ai', verifiedAt: VERIFIED_AT,
      auth: { type: 'bearer' }, docsUrl: 'https://docs.z.ai/guides/overview/quick-start', aliases: ['z ai','z.ai','glm','bigmodel','zhipu'],
      endpoints: [
        ep('chat', 'General API Chat', 'POST', '/api/paas/v4/chat/completions', 'openai_chat', { default: true }),
        ep('coding-chat', 'Coding Plan Chat', 'POST', '/api/coding/paas/v4/chat/completions', 'openai_chat'),
        ep('messages', 'Claude Code / Anthropic Messages', 'POST', '/v1/messages', 'anthropic_messages', {
          baseUrl: 'https://api.z.ai/api/anthropic', auth: { type: 'bearer' }, headers: { 'anthropic-version': '2023-06-01' }
        })
      ]
    },
    {
      id: 'tabitoken', name: 'TabiToken / TaBiAI', baseUrl: 'https://tabitoken.com', trust: 'community', observedAt: VERIFIED_AT,
      auth: { type: 'bearer' }, docsUrl: 'https://github.com/panxunying/ai-coding-welfare',
      aliases: ['tabi','tabi token','tabiai','claude gateway','claude reseller','new-api','openai compatible','anthropic compatible'],
      note: 'Community-sourced preset. Endpoint availability, billing, model access, and WAF behavior can change without notice.',
      endpoints: [
        ep('models', 'Community: List Models', 'GET', '/v1/models', 'models'),
        ep('chat', 'Community: OpenAI Chat', 'POST', '/v1/chat/completions', 'openai_chat', { default: true }),
        ep('messages', 'Community: Anthropic Messages', 'POST', '/v1/messages', 'anthropic_messages', { headers: { 'anthropic-version': '2023-06-01' } })
      ]
    }
  ];

  for (const provider of PROVIDERS) {
    if (!provider.trust) provider.trust = 'verified';
    if (!Array.isArray(provider.aliases)) provider.aliases = [];
    provider.aliases = [...new Set([provider.id, provider.name, ...provider.aliases].filter(Boolean))];
  }

  function getProvider(id) {
    return PROVIDERS.find((provider) => provider.id === String(id || '').trim()) || null;
  }

  function getEndpoint(providerId, endpointId) {
    const provider = getProvider(providerId);
    if (!provider) return null;
    return provider.endpoints.find((endpoint) => endpoint.id === String(endpointId || '').trim()) || null;
  }

  function getModelsEndpoint(providerId) {
    const provider = getProvider(providerId);
    if (!provider) return null;
    return provider.endpoints.find((endpoint) => String(endpoint.format).startsWith('models')) || null;
  }

  function defaultEndpoint(provider) {
    if (!provider) return null;
    return provider.endpoints.find((endpoint) => endpoint.default) ||
      provider.endpoints.find((endpoint) => ['chat','messages','responses','generate','agent'].includes(endpoint.id)) ||
      provider.endpoints.find((endpoint) => !String(endpoint.format).startsWith('models')) ||
      provider.endpoints[0] || null;
  }

  function searchableText(provider) {
    let host = '';
    try { host = new URL(provider.baseUrl).hostname; } catch {}
    return [provider.id, provider.name, host, provider.baseUrl, provider.trust, provider.note || '', ...(provider.aliases || [])]
      .join(' ')
      .toLocaleLowerCase();
  }

  function searchProviders(query, options = {}) {
    const includeCommunity = options.includeCommunity !== false;
    const q = String(query || '').trim().toLocaleLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    const candidates = PROVIDERS.filter((provider) => includeCommunity || provider.trust !== 'community');

    return candidates
      .map((provider) => {
        const text = searchableText(provider);
        if (!terms.length) return { provider, score: provider.trust === 'verified' ? 10 : 5 };
        if (!terms.every((term) => text.includes(term))) return null;
        let score = 20;
        const id = provider.id.toLocaleLowerCase();
        const name = provider.name.toLocaleLowerCase();
        if (id === q || name === q) score += 100;
        else if (id.startsWith(q) || name.startsWith(q)) score += 60;
        else if (id.includes(q) || name.includes(q)) score += 35;
        if (provider.trust === 'verified') score += 4;
        return { provider, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || a.provider.name.localeCompare(b.provider.name))
      .map((entry) => entry.provider);
  }

  function getAutoSetup(providerId, endpointId) {
    const provider = getProvider(providerId);
    if (!provider) return null;
    const endpoint = endpointId ? getEndpoint(providerId, endpointId) : defaultEndpoint(provider);
    if (!endpoint) return null;
    const auth = endpoint.auth || provider.auth || { type: 'bearer' };
    const headers = { ...(provider.headers || {}), ...(endpoint.headers || {}) };
    const modelsEndpoint = getModelsEndpoint(provider.id);
    return {
      providerId: provider.id,
      providerName: provider.name,
      trust: provider.trust,
      verifiedAt: provider.verifiedAt || null,
      observedAt: provider.observedAt || null,
      note: provider.note || '',
      docsUrl: provider.docsUrl || '',
      endpointId: endpoint.id,
      endpointLabel: endpoint.label,
      baseUrl: endpoint.baseUrl || provider.baseUrl,
      path: endpoint.path,
      method: endpoint.method,
      format: endpoint.format,
      auth: { ...auth },
      headers,
      modelsPath: modelsEndpoint?.path || ''
    };
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

  return {
    VERIFIED_AT,
    PROVIDERS,
    getProvider,
    getEndpoint,
    getModelsEndpoint,
    searchProviders,
    getAutoSetup,
    resolveEndpointPath,
    validateModelForPath
  };
});
