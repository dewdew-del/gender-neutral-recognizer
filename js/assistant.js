(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Assistant = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const URL = 'https://api.groq.com/openai/v1/chat/completions';
  const MODEL = 'llama-3.3-70b-versatile';
  const MAX_HISTORY = 6;

  function systemPrompt(terms) {
    const list = terms.map(t => t.term + ' -> ' + t.suggestion).join('; ');
    return [
      'You are the help assistant for the "Gender Neutral Language Recognizer", a student final project for Automata and Language Theory (BSCS 3A).',
      'The app is a static web page written in HTML, CSS and JavaScript. It reads .txt, .docx (mammoth.js) and .pdf (pdf.js) files.',
      'It finds gender-specific terms with a hand-built deterministic finite automaton (a trie with 125 states, alphabet a-z and space, case-insensitive, whole-word, longest match, space self-loop for phrases like "cleaning lady"). It does not use regular expressions to match terms, and it never rewrites the document: it only shows counts, highlights and suggestions.',
      'The 24 terms and suggestions are: ' + list + '.',
      'Answer questions about how the app works, finite automata, and why gender-neutral language matters. Keep answers short (under 120 words), friendly and plain. If a question is unrelated, say you can only help with this project.',
    ].join('\n');
  }

  function buildMessages(question, history, terms) {
    return [{ role: 'system', content: systemPrompt(terms) }]
      .concat(history.slice(-MAX_HISTORY))
      .concat([{ role: 'user', content: question }]);
  }

  async function askGroq({ key, messages, fetchImpl }) {
    if (!key) throw new Error('Please enter your Groq API key first.');
    const doFetch = fetchImpl || globalThis.fetch;
    let res;
    try {
      res = await doFetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
        body: JSON.stringify({ model: MODEL, messages, temperature: 0.3, max_tokens: 400 }),
      });
    } catch (err) {
      throw new Error('Could not reach Groq. Check your internet connection.');
    }
    if (res.status === 401) throw new Error('That API key was rejected. Check it and try again.');
    if (res.status === 429) throw new Error('Too many requests right now. Wait a moment and try again.');
    if (!res.ok) throw new Error('Groq could not answer right now. Please try again.');
    const data = await res.json();
    return data.choices[0].message.content.trim();
  }

  return { URL, MODEL, buildMessages, askGroq };
});
