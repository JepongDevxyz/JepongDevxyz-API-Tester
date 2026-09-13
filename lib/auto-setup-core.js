(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AutoSetupCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function isModelsEndpoint(endpoint) {
    return !!endpoint && String(endpoint.format || '').startsWith('models');
  }

  function probeCandidates(provider, selectedEndpointId) {
    if (!provider || !Array.isArray(provider.endpoints)) return [];
    const usable = provider.endpoints.filter((endpoint) => !isModelsEndpoint(endpoint));
    const out = [];
    const push = (endpoint) => {
      if (endpoint && !out.some((x) => x.id === endpoint.id)) out.push(endpoint);
    };
    push(usable.find((endpoint) => endpoint.id === selectedEndpointId));
    push(usable.find((endpoint) => endpoint.default));
    for (const endpoint of usable) push(endpoint);
    return out;
  }

  function flatten(value, seen = new Set()) {
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (seen.has(value)) return '';
    if (typeof value !== 'object') return '';
    seen.add(value);
    if (Array.isArray(value)) return value.map((item) => flatten(item, seen)).join(' ');
    return Object.entries(value).map(([key, item]) => `${key} ${flatten(item, seen)}`).join(' ');
  }

  function classifyProbeResult(result) {
    const reachedServer = result?.reachedServer !== false;
    if (!reachedServer) {
      return { kind: 'transport', message: result?.error || 'Network/CORS transport failure' };
    }

    const text = flatten(result?.data ?? result?.error ?? '').toLowerCase();
    if (/unauthorized[_\s-]*client|unauthorized_client_error/.test(text)) {
      return { kind: 'client_blocked', message: 'Provider reached, but this client is not authorized.' };
    }
    if (result?.ok) return { kind: 'success', message: 'Working provider setup confirmed.' };

    const status = Number(result?.status || 0);
    if (status === 401 || status === 403 || /unauthenticated|invalid api key|invalid_api_key|authentication/.test(text)) {
      return { kind: 'auth_failed', message: 'Provider rejected the API key or authentication method.' };
    }
    if (status === 404 || status === 405 || /not found|unsupported endpoint|method not allowed/.test(text)) {
      return { kind: 'unsupported', message: 'Endpoint is not supported by this provider.' };
    }
    if (status === 429 || /rate.?limit|too many requests/.test(text)) {
      return { kind: 'rate_limited', message: 'Provider rate limit reached during setup test.' };
    }
    if (status >= 500) return { kind: 'server_error', message: 'Provider server error during setup test.' };
    if (status === 400 || status === 422) return { kind: 'invalid_request', message: 'Endpoint was reached but rejected the probe request.' };
    return { kind: 'failed', message: `Provider request failed${status ? ` with HTTP ${status}` : ''}.` };
  }

  function modelScore(id) {
    const value = String(id || '').trim().toLowerCase();
    if (!value) return -Infinity;
    if (/(embedding|embed-|rerank|whisper|transcrib|speech|tts|audio|moderation|guard|safety|ocr|image[-_/]|stable-diffusion|flux[-_/])/.test(value)) return -1000;
    let score = 0;
    if (/(gpt|claude|gemini|llama|mistral|mixtral|qwen|deepseek|grok|command|glm|kimi|nova|chat|instruct)/.test(value)) score += 100;
    if (/(mini|flash|small|lite|8b|7b)/.test(value)) score += 12;
    if (/(preview|experimental|deprecated|legacy)/.test(value)) score -= 15;
    score -= Math.min(value.length, 100) / 1000;
    return score;
  }

  function chooseProbeModel(ids) {
    const unique = [...new Set((Array.isArray(ids) ? ids : []).map((id) => String(id || '').trim()).filter(Boolean))];
    if (!unique.length) return '';
    return unique
      .map((id, index) => ({ id, index, score: modelScore(id) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.id || '';
  }

  function normalizeDiscoveryURL(input) {
    const raw = String(input || '').trim();
    if (!raw) throw new Error('Enter an API base URL or full endpoint.');
    let url;
    try { url = new URL(raw); } catch { throw new Error('Enter a valid API URL.'); }
    if (url.protocol !== 'https:') throw new Error('API discovery requires HTTPS.');
    if (url.username || url.password) throw new Error('API URL must not contain embedded credentials.');
    url.hash = '';
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString().replace(/\/$/, url.pathname === '/' ? '/' : '');
  }

  function inferRequestFormat(input) {
    const value = String(input || '').toLowerCase().replace(/[?#].*$/, '').replace(/\/+$/, '');
    if (/\/chat\/completions$/.test(value)) return 'openai_chat';
    if (/\/responses$/.test(value)) return 'openai_responses';
    if (/\/messages$/.test(value)) return 'anthropic_messages';
    if (/:generatecontent$/.test(value)) return 'gemini_generate';
    return '';
  }

  function isExactRequestEndpoint(input) {
    return !!inferRequestFormat(input);
  }

  function appendRoute(baseUrl, route) {
    const base = normalizeDiscoveryURL(baseUrl).replace(/\/+$/, '');
    const suffix = String(route || '').replace(/^\/+/, '');
    return suffix ? `${base}/${suffix}` : base;
  }

  function preferredAuthModes(input, keyPresent) {
    if (!keyPresent) return ['none'];
    const url = new URL(normalizeDiscoveryURL(input));
    const host = url.hostname.toLowerCase();
    if (host === 'generativelanguage.googleapis.com' || host.endsWith('.googleapis.com')) {
      return ['x-goog-api-key', 'none', 'bearer', 'x-api-key'];
    }
    if (host === 'api.anthropic.com' || host.endsWith('.anthropic.com')) {
      return ['x-api-key', 'none', 'bearer'];
    }
    return ['none', 'bearer', 'x-api-key', 'x-goog-api-key'];
  }

  function buildEndpointDiscoveryPlan(input, options = {}) {
    const baseUrl = normalizeDiscoveryURL(input);
    const authModes = preferredAuthModes(baseUrl, !!options.keyPresent);
    const format = inferRequestFormat(baseUrl);
    if (format) {
      return {
        baseUrl,
        exact: true,
        authModes,
        models: [],
        requests: [{
          id: format,
          url: baseUrl,
          method: 'POST',
          format,
          pathTemplate: baseUrl
        }]
      };
    }

    const url = new URL(baseUrl);
    const isGoogle = url.hostname === 'generativelanguage.googleapis.com' || url.hostname.endsWith('.googleapis.com');
    const requests = [
      { id: 'openai-chat', url: appendRoute(baseUrl, 'chat/completions'), method: 'POST', format: 'openai_chat', pathTemplate: appendRoute(baseUrl, 'chat/completions') },
      { id: 'openai-responses', url: appendRoute(baseUrl, 'responses'), method: 'POST', format: 'openai_responses', pathTemplate: appendRoute(baseUrl, 'responses') },
      { id: 'anthropic-messages', url: appendRoute(baseUrl, 'messages'), method: 'POST', format: 'anthropic_messages', pathTemplate: appendRoute(baseUrl, 'messages') }
    ];
    if (isGoogle) {
      requests.unshift({
        id: 'gemini-generate',
        url: '',
        method: 'POST',
        format: 'gemini_generate',
        pathTemplate: appendRoute(baseUrl, 'models/{model}:generateContent')
      });
    }

    return {
      baseUrl,
      exact: false,
      authModes,
      models: [{ id: 'models', url: appendRoute(baseUrl, 'models'), method: 'GET', format: 'models' }],
      requests
    };
  }

  function isReachableRouteResult(result) {
    if (!result || result.reachedServer === false) return false;
    if (result.ok) return true;
    const status = Number(result.status || 0);
    return status === 400 || status === 401 || status === 403 || status === 409 || status === 422 || status === 429;
  }

  return {
    isModelsEndpoint,
    probeCandidates,
    classifyProbeResult,
    chooseProbeModel,
    modelScore,
    normalizeDiscoveryURL,
    inferRequestFormat,
    preferredAuthModes,
    buildEndpointDiscoveryPlan,
    isReachableRouteResult
  };
});
