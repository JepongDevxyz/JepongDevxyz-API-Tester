const dns = require('node:dns').promises;
const net = require('node:net');
const { buildUpstreamRequest, normalizeAllowlist, isPrivateIpv4, isPrivateIpv6 } = require('../lib/proxy-core');

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

function parseBody(req) {
  if (!req || req.body == null) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); }
    catch { throw new Error('Invalid JSON body'); }
  }
  if (typeof req.body !== 'object' || Array.isArray(req.body)) throw new Error('Invalid request body');
  return req.body;
}

async function assertPublicDns(urlString) {
  const url = new URL(urlString);
  const host = url.hostname;
  const literalType = net.isIP(host);
  if (literalType === 4 && isPrivateIpv4(host)) throw new Error('Custom proxy target resolves to a private IPv4 address');
  if (literalType === 6 && isPrivateIpv6(host)) throw new Error('Custom proxy target resolves to a private IPv6 address');
  if (literalType) return;

  const records = await dns.lookup(host, { all: true, verbatim: true });
  if (!records.length) throw new Error('Custom proxy target did not resolve');
  for (const record of records) {
    if (record.family === 4 && isPrivateIpv4(record.address)) throw new Error('Custom proxy target resolves to a private IPv4 address');
    if (record.family === 6 && isPrivateIpv6(record.address)) throw new Error('Custom proxy target resolves to a private IPv6 address');
  }
}

async function readTextLimited(response) {
  const declared = Number(response.headers?.get?.('content-length') || 0);
  if (declared > MAX_RESPONSE_BYTES) throw new Error('Upstream response is too large');

  if (!response.body?.getReader) {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) throw new Error('Upstream response is too large');
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      try { await reader.cancel(); } catch {}
      throw new Error('Upstream response is too large');
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text;
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

  let input;
  let built;
  try {
    input = parseBody(req);
    built = buildUpstreamRequest({
      ...input,
      customProxyAllowlist: normalizeAllowlist(process.env.CUSTOM_PROXY_ALLOWLIST || '')
    });
    if (built.providerId === 'custom') await assertPublicDns(built.url);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Invalid request' });
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  const started = Date.now();

  try {
    const upstream = await fetch(built.url, {
      ...built.options,
      signal: controller.signal,
      redirect: 'error'
    });
    const text = await readTextLimited(upstream);
    let data;
    try { data = text ? JSON.parse(text) : null; }
    catch { data = { raw: text }; }

    res.status(upstream.status).json({
      proxy: true,
      provider: built.providerName,
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
      provider: built.providerName,
      upstreamOk: false,
      upstreamStatus: 0,
      latencyMs: Date.now() - started,
      endpoint: built.endpoint,
      error: timedOut ? 'Upstream request timed out' : (error.message || 'Upstream request failed')
    });
  } finally {
    clearTimeout(timer);
  }
};

module.exports._test = { parseBody, assertPublicDns, readTextLimited };
