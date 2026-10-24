const test = require('node:test');
const assert = require('node:assert');
const { TERMS } = require('../js/terms.js');
const FSA = require('../js/fsa.js');

test('term list has 24 lowercase terms with suggestions', () => {
  assert.strictEqual(TERMS.length, 24);
  for (const t of TERMS) {
    assert.strictEqual(t.term, t.term.toLowerCase());
    assert.ok(t.suggestion.length > 0);
  }
});

test('sym maps letters, whitespace, and others', () => {
  assert.strictEqual(FSA.sym('A'), 'a');
  assert.strictEqual(FSA.sym('\t'), ' ');
  assert.strictEqual(FSA.sym('\r'), ' ');
  assert.strictEqual(FSA.sym(','), null);
  assert.strictEqual(FSA.sym('é'), null);
});

test('buildDFA shares prefixes and marks accepting states', () => {
  const dfa = FSA.buildDFA([{ term: 'he' }, { term: 'her' }, { term: 'him' }]);
  // q0 -h-> q1 -e-> q2(he) -r-> q3(her);  q1 -i-> q4 -m-> q5(him)
  assert.strictEqual(dfa.states, 6);
  const h = dfa.delta[0]['h'];
  const he = dfa.delta[h]['e'];
  assert.strictEqual(dfa.accept[he], 0);
  assert.strictEqual(dfa.accept[dfa.delta[he]['r']], 1);
  assert.strictEqual(dfa.delta[0]['t'], undefined);   // dead
});

test('states entered on space loop on space', () => {
  const dfa = FSA.buildDFA([{ term: 'cleaning lady' }]);
  let s = 0;
  for (const c of 'cleaning ') s = dfa.delta[s][c];
  assert.strictEqual(dfa.delta[s][' '], s);
});

const dfa = FSA.buildDFA(TERMS);
const found = (text) => FSA.scan(dfa, text).map(m => TERMS[m.termIndex].term);

test('every term matches on its own', () => {
  for (const t of TERMS) assert.deepStrictEqual(found(t.term), [t.term]);
});
test('"he" is not found inside other words', () => {
  assert.deepStrictEqual(found('the there other hello shell'), []);
});
test('case-insensitive counting', () => {
  const s = FSA.summarize(FSA.scan(dfa, 'CHAIRMAN Chairman chairman'), TERMS);
  assert.deepStrictEqual(s, [{ term: 'chairman', suggestion: 'chairperson', count: 3 }]);
});
test('longest match wins', () => {
  assert.deepStrictEqual(found('herself hers her he'), ['herself', 'hers', 'her', 'he']);
});
test('punctuation and apostrophes are boundaries', () => {
  assert.deepStrictEqual(found('fireman, (she) he\'s he’s he—she'), ['fireman', 'she', 'he', 'he', 'he', 'she']);
});
test('phrases match across extra whitespace and CRLF', () => {
  assert.deepStrictEqual(found('cleaning lady'), ['cleaning lady']);
  assert.deepStrictEqual(found('cleaning  lady'), ['cleaning lady']);
  assert.deepStrictEqual(found('cleaning\r\nlady'), ['cleaning lady']);
  assert.deepStrictEqual(found('cleaning'), []);
});
test('match positions point into the original text', () => {
  assert.deepStrictEqual(FSA.scan(dfa, 'The Chairman.'), [{ termIndex: 0, start: 4, end: 12 }]);
});
test('leading BOM does not hide the first word', () => {
  assert.deepStrictEqual(found('﻿He said'), ['he']);
});
test('empty text has no matches', () => {
  assert.deepStrictEqual(FSA.scan(dfa, ''), []);
});
test('1 MB of text scans in under 1 second', () => {
  const big = 'The chairman said that he and the other firefighters left. '.repeat(17000);
  const t0 = Date.now();
  FSA.scan(dfa, big);
  assert.ok(Date.now() - t0 < 1000);
});

test('trace accepts fireman and shows its path', () => {
  const t = FSA.trace(dfa, 'Fireman');
  assert.strictEqual(t.accepted, true);
  assert.strictEqual(TERMS[t.termIndex].term, 'fireman');
  assert.strictEqual(t.path.length, 7);
  assert.strictEqual(t.path[0].from, 0);
});
test('trace rejects "the" at the first symbol', () => {
  const t = FSA.trace(dfa, 'the');
  assert.strictEqual(t.accepted, false);
  assert.deepStrictEqual(t.path, [{ from: 0, symbol: 't', to: null }]);
});
test('trace rejects a proper prefix like "chair"', () => {
  assert.strictEqual(FSA.trace(dfa, 'chair').accepted, false);
});
test('transitionRows lists every state once', () => {
  const rows = FSA.transitionRows(dfa, TERMS);
  assert.strictEqual(rows.length, dfa.states);
  assert.strictEqual(rows.filter(r => r.accepting).length, 24);
  assert.ok(rows[0].transitions.some(([s]) => s === 'h'));
});

test('analyze counts words and reports near misses that are not whole words', () => {
  const text = 'He said hello to the herself-less shell';
  const a = FSA.analyze(dfa, text);
  assert.strictEqual(a.chars, text.length);
  assert.strictEqual(a.words, 8);
  assert.deepStrictEqual(a.matches, FSA.scan(dfa, text));
  // "hello" reaches the accepting state of "he" and "shell" that of "she", but neither is a whole word; "the" never does
  const miss = a.nearMisses.map(m => text.slice(m.start, m.end) + '|' + TERMS[m.termIndex].term);
  assert.deepStrictEqual(miss, ['he|he', 'she|she']);
});

test('analyze ignores near misses hidden by a longer match', () => {
  const a = FSA.analyze(dfa, 'herself');
  assert.strictEqual(a.matches.length, 1);
  assert.deepStrictEqual(a.nearMisses, []);
});

test('analyze of empty text', () => {
  assert.deepStrictEqual(FSA.analyze(dfa, ''), { chars: 0, words: 0, matches: [], nearMisses: [] });
});
