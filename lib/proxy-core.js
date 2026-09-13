const net = require('node:net');
const presets = require('./provider-presets');

const PROTECTED_HEADERS = new Set([
  'host', 'content-length', 'connection', 'transfer-encoding', 'keep-alive',
  'upgrade', 'proxy-authorization', 'proxy-authenticate', 'te', 'trailer'
]);

function validateApiKey(apiKey, required = true) {
  const key = String(apiKey || '').trim();
  if (!required && !key) return '';
  if (!key || key.length > 2048 || /[\r\n]/.test(key)) throw new Error('Invalid API key');
  return key;
}

function validateModel(model, required = true) {
  const value = String(model || '').trim();
  if (!required && !value) return '';
  if (!value || value.length > 256 || /[\r\n\0]/.test(value)) throw new Error('Invalid model');
  return value;
}

function validatePrompt(prompt, required = true) {
  const value = String(prompt ?? '');
  if (!required && !value.trim()) return '';
  if (!value.trim()) throw new Error('Prompt is required');
  if (value.length > 50000) throw new Error('Prompt is too long');
  return value;
}

function normalizeMaxTokens(value) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return 32;
  return Math.max(1, Math.min(n, 16384));
}

function isPrivateIpv4(address) {
  const p = address.split('.').map(Number);
  if (p.length !== 4 || p.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) return true;
  const [a, b] = p;
  return a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224;
}

function isPrivateIpv6(address) {
  const value = address.toLowerCase();
  if (value === '::' || value === '::1') return true;
  if (value.startsWith('fc') || value.startsWith('fd')) return true;
  if (/^fe[89ab]/.test(value)) return true;
  if (value.startsWith('::ffff:')) {
    const mapped = value.slice('::ffff:'.length);
    if (net.isIP(mapped) === 4) return isPrivateIpv4(mapped);
  }
  return false;
}

function validatePublicHttpsBaseUrl(value) {
  let url;
  try { url = new URL(String(value || '').trim()); }
  catch { throw new Error('Invalid custom base URL'); }
  if (url.protocol !== 'https:') throw new Error('Custom base URL must use HTTPS');
  if (url.username || url.password) throw new Error('Credentials are not allowed in custom base URL');
  const host = url.hostname.toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('Private/local custom targets are not allowed');
  }
  const ipType = net.isIP(host);
  if ((ipType === 4 && isPrivateIpv4(host)) || (ipType === 6 && isPrivateIpv6(host))) {
    throw new Error('Private/local custom targets are not allowed');
  }
  url.pathname = url.pathname.replace(/\/+$/, '');
  url.search = '';
  url.hash = '';
  return url;
}

function normalizeAllowlist(value) {
  const items = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(items.map((x) => String(x).trim().toLowerCase()).filter(Boolean))];
}

function requireAllowlistedHost(hostname, allowlist) {
  const host = String(hostname || '').toLowerCase();
  if (!normalizeAllowlist(allowlist).includes(host)) {
    throw new Error(`Custom proxy host is not in CUSTOM_PROXY_ALLOWLIST: ${host || 'unknown'}`);
  }
}

function validatePath(value, allowEmpty = false) {
  const path = String(value || '').trim();
  if (allowEmpty && !path) return '';
  if (!path || !path.startsWith('/') || path.startsWith('//') || /[\r\n]/.test(path)) throw new Error('Invalid endpoint path');
  return path;
}

function validateMethod(value) {
  const method = String(value || 'POST').trim().toUpperCase();
  if (!['GET', 'POST'].includes(method)) throw new Error('Only GET and POST are supported');
  return method;
}

function parseHeaderObject(value) {
  if (!value) return {};
  let object = value;
  if (typeof value === 'string') {
    try { object = JSON.parse(value); }
    catch { throw new Error('Custom headers must be valid JSON'); }
  }
  if (!object || typeof object !== 'object' || Array.isArray(object)) throw new Error('Custom headers must be a JSON object');
  const clean = {};
  for (const [name, raw] of Object.entries(object)) {
    const header = String(name || '').trim();
    if (!/^[A-Za-z0-9-]{1,80}$/.test(header)) throw new Error(`Invalid custom header: ${header}`);
    if (PROTECTED_HEADERS.has(header.toLowerCase())) continue;
    const valueText = String(raw ?? '');
    if (valueText.length > 4096 || /[\r\n]/.test(valueText)) throw new Error(`Invalid custom header value: ${header}`);
    clean[header] = valueText;
  }
  return clean;
}

function effectiveAuth(provider, endpoint, input) {
  if (input.disableAuth === true) return { type: 'none' };
  if (provider) return endpoint.auth || provider.auth || { type: 'bearer' };
  const type = String(input.authMode || 'bearer');
  if (!['bearer', 'x-api-key', 'x-goog-api-key', 'custom-header', 'query-key', 'none'].includes(type)) throw new Error('Unsupported authentication mode');
  return {
    type,
    headerName: String(input.customAuthHeader || '').trim(),
    prefix: String(input.customAuthPrefix ?? '').trim(),
    queryParam: String(input.customQueryParam || 'key').trim()
  };
}

function applyAuth(url, headers, apiKey, auth) {
  const type = auth?.type || 'bearer';
  if (type === 'none') return url;
  const key = validateApiKey(apiKey, true);
  if (type === 'bearer') headers.Authorization = `Bearer ${key}`;
  else if (type === 'x-api-key') headers['x-api-key'] = key;
  else if (type === 'x-goog-api-key') headers['x-goog-api-key'] = key;
  else if (type === 'custom-header') {
    const headerName = String(auth.headerName || '').trim();
    if (!/^[A-Za-z0-9-]{1,80}$/.test(headerName) || PROTECTED_HEADERS.has(headerName.toLowerCase())) throw new Error('Invalid custom auth header');
    const prefix = auth.prefix ? `${auth.prefix} ` : '';
    headers[headerName] = `${prefix}${key}`;
  } else if (type === 'query-key') {
    const queryParam = String(auth.queryParam || 'key').trim();
    if (!/^[A-Za-z0-9_.-]{1,64}$/.test(queryParam)) throw new Error('Invalid API key query parameter');
    url.searchParams.set(queryParam, key);
  }
  return url;
}

function interpolate(value, vars) {
  if (typeof value === 'string') {
    return value
      .replaceAll('{{model}}', vars.model)
      .replaceAll('{{prompt}}', vars.prompt)
      .replaceAll('{{max_tokens}}', String(vars.maxTokens));
  }
  if (Array.isArray(value)) return value.map((item) => interpolate(item, vars));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, interpolate(v, vars)]));
  }
  return value;
}

function buildBody(format, input) {
  const maxTokens = normalizeMaxTokens(input.maxTokens);
  if (format === 'none' || format === 'models' || format === 'models_gemini' || format === 'models_cohere') return undefined;

  if (format === 'generic_json') {
    let parsed = {};
    if (String(input.customBody || '').trim()) {
      try { parsed = JSON.parse(String(input.customBody)); }
      catch { throw new Error('Custom body must be valid JSON'); }
    }
    const model = validateModel(input.model, false);
    const prompt = validatePrompt(input.prompt, false);
    return JSON.stringify(interpolate(parsed, { model, prompt, maxTokens }));
  }

  const model = validateModel(input.model, true);
  const prompt = validatePrompt(input.prompt, true);

  if (format === 'openai_chat') {
    return JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature: 0, stream: false });
  }
  if (format === 'openai_responses') {
    return JSON.stringify({ model, input: prompt, max_output_tokens: maxTokens, stream: false });
  }
  if (format === 'anthropic_messages') {
    return JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }], temperature: 0 });
  }
  if (format === 'gemini_generate') {
    return JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens } });
  }
  if (format === 'cohere_chat') {
    return JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, stream: false });
  }
  throw new Error(`Unsupported request format: ${format}`);
}

function joinUrl(baseUrl, path, appendToBasePath = false) {
  const base = new URL(baseUrl);
  const cleanPath = validatePath(path, true);
  if (!cleanPath) {
    const exact = new URL(base.toString());
    exact.search = '';
    exact.hash = '';
    return exact;
  }
  let pathname;
  if (appendToBasePath) {
    const basePath = base.pathname.replace(/\/+$/, '');
    pathname = `${basePath}${cleanPath}`.replace(/\/{2,}/g, '/');
  } else {
    pathname = cleanPath;
  }
  const url = new URL(base.origin);
  url.pathname = pathname;
  return url;
}

function buildUpstreamRequest(input = {}) {
  const providerId = String(input.providerId || '').trim();
  let provider = null;
  let endpoint = null;
  let baseUrl;
  let path;
  let method;
  let format;
  let baseHeaders = {};
  let appendToBasePath = false;

  if (providerId && providerId !== 'custom') {
    provider = presets.getProvider(providerId);
    if (!provider) throw new Error('Unknown provider preset');
    endpoint = presets.getEndpoint(providerId, input.endpointId);
    if (!endpoint) throw new Error('Unknown provider endpoint preset');
    baseUrl = endpoint.baseUrl || provider.baseUrl;
    path = presets.resolveEndpointPath(endpoint.path, input.model);
    method = endpoint.method;
    format = endpoint.format;
    baseHeaders = { ...(provider.headers || {}), ...(endpoint.headers || {}) };
    if (endpoint.baseUrl) {
      const basePath = new URL(baseUrl).pathname.replace(/\/+$/, '');
      appendToBasePath = Boolean(basePath && basePath !== '/' && path !== basePath && !path.startsWith(basePath + '/'));
    }
  } else {
    const base = validatePublicHttpsBaseUrl(input.customBaseUrl);
    requireAllowlistedHost(base.hostname, input.customProxyAllowlist);
    baseUrl = base.toString();
    path = validatePath(input.customPath, true);
    method = validateMethod(input.customMethod);
    format = String(input.customFormat || (method === 'GET' ? 'none' : 'generic_json')).trim();
    appendToBasePath = Boolean(path && base.pathname && base.pathname !== '/');
  }

  const auth = effectiveAuth(provider, endpoint || {}, input);
  const apiKey = validateApiKey(input.apiKey, auth.type !== 'none');
  const headers = { Accept: 'application/json', ...baseHeaders, ...parseHeaderObject(input.customHeaders) };
  let url = joinUrl(baseUrl, path, appendToBasePath);
  url = applyAuth(url, headers, apiKey, auth);

  const body = method === 'GET' ? undefined : buildBody(format, input);
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  return {
    url: url.toString(),
    endpoint: path || new URL(baseUrl).pathname || '/',
    providerId: provider?.id || 'custom',
    providerName: provider?.name || 'Custom Provider',
    format,
    options: { method, headers, ...(body !== undefined ? { body } : {}) }
  };
}

module.exports = {
  PROTECTED_HEADERS,
  validateApiKey,
  validateModel,
  validatePrompt,
  normalizeMaxTokens,
  validatePublicHttpsBaseUrl,
  normalizeAllowlist,
  requireAllowlistedHost,
  parseHeaderObject,
  buildBody,
  joinUrl,
  buildUpstreamRequest,
  isPrivateIpv4,
  isPrivateIpv6
};
