const test = require('node:test');
const assert = require('node:assert');
const { TERMS } = require('../js/terms.js');
const FSA = require('../js/fsa.js');
const { toSegments } = require('../js/render.js');
const dfa = FSA.buildDFA(TERMS);

test('segments split text around matches', () => {
  const text = 'The chairman spoke';
  assert.deepStrictEqual(toSegments(text, FSA.scan(dfa, text), TERMS), [
    { text: 'The ' },
    { text: 'chairman', term: 'chairman', suggestion: 'chairperson' },
    { text: ' spoke' },
  ]);
});
test('no matches gives one segment, empty text gives none', () => {
  assert.deepStrictEqual(toSegments('neutral', [], TERMS), [{ text: 'neutral' }]);
  assert.deepStrictEqual(toSegments('', [], TERMS), []);
});

const { applySuggestions } = require('../js/render.js');

test('applySuggestions replaces matches and keeps capitalization', () => {
  const text = 'He met the chairman. CHAIRMAN left. Policeman came.';
  const out = applySuggestions(text, FSA.scan(dfa, text), TERMS);
  assert.strictEqual(out, 'They met the chairperson. CHAIRPERSON left. Police officer came.');
});
test('applySuggestions picks the first alternative and leaves other text alone', () => {
  const text = 'Tell her: the theme is hers.\r\nOK';
  const out = applySuggestions(text, FSA.scan(dfa, text), TERMS);
  assert.strictEqual(out, 'Tell them: the theme is theirs.\r\nOK');
  assert.strictEqual(applySuggestions('nothing here', [], TERMS), 'nothing here');
  assert.strictEqual(applySuggestions('', [], TERMS), '');
});
