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
