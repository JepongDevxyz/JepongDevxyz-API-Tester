const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/agentrouter');

function createRes() {
  return {
    statusCode: 200,
    headers: {},
    payload: undefined,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.payload = value; return this; },
    end() { return this; }
  };
}

test('handler rejects non-POST methods', async () => {
  const res = createRes();
  await handler({ method: 'GET', body: {} }, res);
  assert.equal(res.statusCode, 405);
  assert.match(res.payload.error, /POST/i);
});

test('handler validates request before upstream fetch', async () => {
  const previous = global.fetch;
  let called = false;
  global.fetch = async () => { called = true; throw new Error('should not run'); };
  try {
    const res = createRes();
    await handler({ method: 'POST', body: { operation: 'chat', apiKey: '', model: 'x', prompt: 'x' } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(called, false);
  } finally {
    global.fetch = previous;
  }
});

test('handler proxies upstream status and body without echoing API key', async () => {
  const previous = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ choices: [{ message: { content: 'OK' } }] })
  });
  try {
    const res = createRes();
    await handler({ method: 'POST', body: { operation: 'chat', apiKey: 'sk-super-secret', model: 'deepseek-v4-flash', prompt: 'Reply OK', maxTokens: 16 } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.upstreamStatus, 200);
    assert.equal(res.payload.data.choices[0].message.content, 'OK');
    assert.equal(JSON.stringify(res.payload).includes('sk-super-secret'), false);
  } finally {
    global.fetch = previous;
  }
});
