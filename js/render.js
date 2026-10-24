(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Render = api;
})(typeof self !== 'undefined' ? self : this, function () {
  // Split text into plain and matched segments, covering all of the text in order.
  function toSegments(text, matches, terms) {
    const segments = [];
    let pos = 0;
    for (const m of matches) {
      if (m.start > pos) segments.push({ text: text.slice(pos, m.start) });
      const t = terms[m.termIndex];
      segments.push({ text: text.slice(m.start, m.end), term: t.term, suggestion: t.suggestion });
      pos = m.end;
    }
    if (pos < text.length) segments.push({ text: text.slice(pos) });
    return segments;
  }

  // Build a corrected copy: each match is replaced by its first suggested alternative,
  // keeping the original capitalization (he -> they, He -> They, HE -> THEY).
  function matchCase(original, replacement) {
    const letters = original.replace(/[^\p{L}]/gu, '');
    if (letters.length > 1 && letters === letters.toUpperCase()) return replacement.toUpperCase();
    if (/^\p{Lu}/u.test(original)) return replacement.charAt(0).toUpperCase() + replacement.slice(1);
    return replacement;
  }
  function applySuggestions(text, matches, terms) {
    let out = '';
    let pos = 0;
    for (const m of matches) {
      out += text.slice(pos, m.start);
      const first = terms[m.termIndex].suggestion.split('/')[0].trim();
      out += matchCase(text.slice(m.start, m.end), first);
      pos = m.end;
    }
    return out + text.slice(pos);
  }

  return { toSegments, applySuggestions };
});
