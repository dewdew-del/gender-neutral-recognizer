const test = require('node:test');
const assert = require('node:assert');
const { TERMS } = require('../js/terms.js');
const { buildMessages, askGroq, MODEL, URL } = require('../js/assistant.js');

test('system prompt carries the project facts and all 24 terms', () => {
  const msgs = buildMessages('What is a DFA?', [], TERMS);
  assert.strictEqual(msgs[0].role, 'system');
  assert.match(msgs[0].content, /finite automaton/i);
  for (const t of TERMS) assert.ok(msgs[0].content.includes(t.term));
  assert.deepStrictEqual(msgs[msgs.length - 1], { role: 'user', content: 'What is a DFA?' });
});

test('history is kept but capped at the last 6 messages', () => {
  const history = [];
  for (let i = 0; i < 10; i++) history.push({ role: i % 2 ? 'assistant' : 'user', content: 'm' + i });
  const msgs = buildMessages('next', history, TERMS);
  assert.strictEqual(msgs.length, 1 + 6 + 1);
  assert.strictEqual(msgs[1].content, 'm4');
});

test('askGroq sends the key and returns the reply text', async () => {
  let seen;
  const fetchImpl = async (url, opts) => {
    seen = { url, opts };
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: ' Hello ' } }] }) };
  };
  const reply = await askGroq({ key: 'gsk_test', messages: [{ role: 'user', content: 'hi' }], fetchImpl });
  assert.strictEqual(reply, 'Hello');
  assert.strictEqual(seen.url, URL);
  assert.strictEqual(seen.opts.headers.Authorization, 'Bearer gsk_test');
  const body = JSON.parse(seen.opts.body);
  assert.strictEqual(body.model, MODEL);
  assert.deepStrictEqual(body.messages, [{ role: 'user', content: 'hi' }]);
});

test('askGroq turns failures into friendly errors', async () => {
  const bad = (status) => async () => ({ ok: false, status, json: async () => ({}) });
  await assert.rejects(askGroq({ key: 'x', messages: [], fetchImpl: bad(401) }), /key was rejected/i);
  await assert.rejects(askGroq({ key: 'x', messages: [], fetchImpl: bad(429) }), /too many requests/i);
  await assert.rejects(askGroq({ key: 'x', messages: [], fetchImpl: bad(500) }), /could not answer/i);
  await assert.rejects(askGroq({ key: 'x', messages: [], fetchImpl: async () => { throw new Error('net'); } }), /could not reach/i);
  await assert.rejects(askGroq({ key: '', messages: [], fetchImpl: bad(200) }), /api key/i);
});

const { sanitizeRequest, askProxy } = require('../js/assistant.js');

test('sanitizeRequest trims, caps and filters', () => {
  const r = sanitizeRequest({
    question: '  What is a DFA?  ',
    history: [{ role: 'system', content: 'evil' }, { role: 'user', content: 'x'.repeat(2000) }, { role: 'assistant', content: 'ok' }, 'junk'],
  });
  assert.strictEqual(r.question, 'What is a DFA?');
  assert.deepStrictEqual(r.history.map(m => m.role), ['user', 'assistant']);
  assert.strictEqual(r.history[0].content.length, 1000);
  assert.throws(() => sanitizeRequest({ question: '   ' }), /question/i);
  assert.throws(() => sanitizeRequest({ question: 'q'.repeat(501) }), /too long/i);
  assert.deepStrictEqual(sanitizeRequest({ question: 'hi' }).history, []);
});

test('askProxy returns the reply and maps errors', async () => {
  const ok = async () => ({ ok: true, status: 200, json: async () => ({ reply: 'Hi there' }) });
  assert.strictEqual(await askProxy({ question: 'hi', history: [], fetchImpl: ok }), 'Hi there');
  const st = (status) => async () => ({ ok: false, status, json: async () => ({}) });
  await assert.rejects(askProxy({ question: 'hi', history: [], fetchImpl: st(404) }), { code: 'NO_PROXY' });
  await assert.rejects(askProxy({ question: 'hi', history: [], fetchImpl: st(429) }), /too many requests/i);
  await assert.rejects(askProxy({ question: 'hi', history: [], fetchImpl: st(500) }), /could not answer/i);
  await assert.rejects(askProxy({ question: 'hi', history: [], fetchImpl: async () => { throw new Error('x'); } }), { code: 'NO_PROXY' });
});

test('serverless handler uses the server-side key and rejects bad calls', async () => {
  const handler = require('../api/ask.js');
  const mkRes = () => { const r = { code: 200, body: null, headers: {} }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; r.setHeader = (k, v) => { r.headers[k] = v; }; return r; };
  let res = mkRes(); await handler({ method: 'GET', headers: {} }, res); assert.strictEqual(res.code, 405);
  delete process.env.GROQ_API_KEY;
  res = mkRes(); await handler({ method: 'POST', headers: {}, body: { question: 'hi' } }, res); assert.strictEqual(res.code, 500);
  process.env.GROQ_API_KEY = 'gsk_server';
  let seen;
  globalThis.fetch = async (url, opts) => { seen = opts; return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'Answer' } }] }) }; };
  res = mkRes(); await handler({ method: 'POST', headers: { 'x-forwarded-for': '1.1.1.1' }, body: { question: 'What is a DFA?' } }, res);
  assert.strictEqual(res.code, 200); assert.deepStrictEqual(res.body, { reply: 'Answer' });
  assert.strictEqual(seen.headers.Authorization, 'Bearer gsk_server');
  res = mkRes(); await handler({ method: 'POST', headers: {}, body: { question: '' } }, res); assert.strictEqual(res.code, 400);
  delete process.env.GROQ_API_KEY;
});
