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

  return { toSegments };
});
