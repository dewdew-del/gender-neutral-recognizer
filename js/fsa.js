(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FSA = api;
})(typeof self !== 'undefined' ? self : this, function () {
  // Alphabet: a-z and space. Anything else has no transition (dead state).
  function sym(ch) {
    const c = ch.toLowerCase();
    if (c.length === 1 && c >= 'a' && c <= 'z') return c;
    if (/\s/.test(ch)) return ' ';
    return null;
  }

  function isWordChar(ch) {
    return /[\p{L}\p{N}]/u.test(ch);
  }

  // Trie DFA: delta[state][symbol] = next state; missing entry = dead.
  function buildDFA(terms) {
    const delta = [{}];
    const accept = {};
    terms.forEach((t, index) => {
      let state = 0;
      for (const ch of t.term) {
        const s = sym(ch);
        if (delta[state][s] === undefined) {
          delta.push({});
          delta[state][s] = delta.length - 1;
          if (s === ' ') delta[delta.length - 1][' '] = delta.length - 1; // space self-loop
        }
        state = delta[state][s];
      }
      accept[state] = index;
    });
    return { start: 0, delta, accept, states: delta.length };
  }

  // Whole-word, case-insensitive, longest-match scan.
  function scan(dfa, text) {
    const matches = [];
    let i = 0;
    while (i < text.length) {
      if (i === 0 || !isWordChar(text[i - 1])) {
        let state = dfa.start;
        let best = null;
        let j = i;
        while (j < text.length) {
          const s = sym(text[j]);
          const next = s === null ? undefined : dfa.delta[state][s];
          if (next === undefined) break;
          state = next;
          j++;
          if (dfa.accept[state] !== undefined && (j === text.length || !isWordChar(text[j]))) {
            best = { termIndex: dfa.accept[state], start: i, end: j };
          }
        }
        if (best) {
          matches.push(best);
          i = best.end;
          continue;
        }
      }
      i++;
    }
    return matches;
  }

  function summarize(matches, terms) {
    const byIndex = new Map();
    for (const m of matches) {
      if (!byIndex.has(m.termIndex)) {
        byIndex.set(m.termIndex, {
          term: terms[m.termIndex].term,
          suggestion: terms[m.termIndex].suggestion,
          count: 0,
        });
      }
      byIndex.get(m.termIndex).count++;
    }
    return [...byIndex.values()];
  }

  // Run the DFA over a whole word/phrase and report the state path.
  function trace(dfa, word) {
    const path = [];
    let state = dfa.start;
    for (const ch of word) {
      const s = sym(ch);
      const next = s === null ? undefined : dfa.delta[state][s];
      if (next === undefined) {
        path.push({ from: state, symbol: ch, to: null });
        return { path, accepted: false, termIndex: null };
      }
      path.push({ from: state, symbol: ch, to: next });
      state = next;
    }
    const idx = dfa.accept[state];
    const accepted = word.length > 0 && idx !== undefined;
    return { path, accepted, termIndex: accepted ? idx : null };
  }

  function transitionRows(dfa, terms) {
    return dfa.delta.map((row, state) => {
      const idx = dfa.accept[state];
      return {
        state,
        transitions: Object.keys(row).sort().map(k => [k, row[k]]),
        accepting: idx !== undefined,
        term: idx !== undefined ? terms[idx].term : null,
      };
    });
  }

  return { sym, isWordChar, buildDFA, scan, summarize, trace, transitionRows };
});
