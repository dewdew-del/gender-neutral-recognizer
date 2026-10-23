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
