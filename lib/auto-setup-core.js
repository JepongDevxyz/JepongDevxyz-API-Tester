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

  return { isModelsEndpoint, probeCandidates, classifyProbeResult, chooseProbeModel, modelScore };
});
