const { buildUpstreamRequest } = require('../lib/proxy-core');

function parseBody(req) {
  if (!req || req.body == null) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); }
    catch { throw new Error('Invalid JSON body'); }
  }
  return req.body;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST for this endpoint.' });
    return;
  }

  let built;
  try {
    built = buildUpstreamRequest(parseBody(req));
  } catch (error) {
    res.status(400).json({ error: error.message || 'Invalid request' });
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  const started = Date.now();

  try {
    const upstream = await fetch(built.url, { ...built.options, signal: controller.signal });
    const text = await upstream.text();
    let data;
    try { data = text ? JSON.parse(text) : null; }
    catch { data = { raw: text }; }

    res.status(upstream.status).json({
      proxy: true,
      upstreamOk: upstream.ok,
      upstreamStatus: upstream.status,
      latencyMs: Date.now() - started,
      endpoint: built.endpoint,
      data
    });
  } catch (error) {
    const timedOut = error && error.name === 'AbortError';
    res.status(timedOut ? 504 : 502).json({
      proxy: true,
      upstreamOk: false,
      upstreamStatus: 0,
      latencyMs: Date.now() - started,
      endpoint: built.endpoint,
      error: timedOut ? 'AgentRouter request timed out' : (error.message || 'Upstream request failed')
    });
  } finally {
    clearTimeout(timer);
  }
};
