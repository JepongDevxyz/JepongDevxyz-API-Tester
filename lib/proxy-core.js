const BASE_URL = 'https://agentrouter.org';
const ALLOWED_OPERATIONS = new Set(['models', 'chat', 'messages']);

function validateApiKey(apiKey) {
  const key = String(apiKey || '').trim();
  if (!key || key.length > 1024 || /[\r\n]/.test(key)) throw new Error('Invalid API key');
  return key;
}

function validateModel(model) {
  const value = String(model || '').trim();
  if (!value || value.length > 128 || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)) throw new Error('Invalid model');
  return value;
}

function validatePrompt(prompt) {
  const value = String(prompt ?? '');
  if (!value.trim()) throw new Error('Prompt is required');
  if (value.length > 20000) throw new Error('Prompt is too long');
  return value;
}

function normalizeMaxTokens(value) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return 32;
  return Math.max(1, Math.min(n, 2048));
}

function authHeaders(apiKey, authMode) {
  if (authMode === 'x-api-key') return { 'x-api-key': apiKey };
  return { Authorization: `Bearer ${apiKey}` };
}

function buildUpstreamRequest(input = {}) {
  const operation = String(input.operation || '').trim();
  if (!ALLOWED_OPERATIONS.has(operation)) throw new Error('Unsupported operation');
  const apiKey = validateApiKey(input.apiKey);
  const authMode = input.authMode === 'x-api-key' ? 'x-api-key' : 'bearer';

  if (operation === 'models') {
    return {
      url: `${BASE_URL}/v1/models`, endpoint: '/v1/models',
      options: { method: 'GET', headers: { ...authHeaders(apiKey, authMode), Accept: 'application/json' } }
    };
  }

  const model = validateModel(input.model);
  const prompt = validatePrompt(input.prompt);
  const maxTokens = normalizeMaxTokens(input.maxTokens);

  if (operation === 'chat') {
    return {
      url: `${BASE_URL}/v1/chat/completions`, endpoint: '/v1/chat/completions',
      options: {
        method: 'POST',
        headers: { ...authHeaders(apiKey, authMode), 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature: 0 })
      }
    };
  }

  return {
    url: `${BASE_URL}/v1/messages`, endpoint: '/v1/messages',
    options: {
      method: 'POST',
      headers: { ...authHeaders(apiKey, authMode), 'Content-Type': 'application/json', Accept: 'application/json', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature: 0 })
    }
  };
}

module.exports = { BASE_URL, validateApiKey, validateModel, validatePrompt, normalizeMaxTokens, buildUpstreamRequest };
