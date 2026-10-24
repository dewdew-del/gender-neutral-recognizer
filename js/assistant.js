(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Assistant = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const URL = 'https://api.groq.com/openai/v1/chat/completions';
  // Tried in order; the next one is used if a model is unavailable to the account (404).
  const MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'openai/gpt-oss-20b'];
  const MODEL = MODELS[0];
  const MAX_HISTORY = 6;

  function systemPrompt(terms) {
    const list = terms.map(t => t.term + ' -> ' + t.suggestion).join('; ');
    return [
      'You are the help assistant for the "Gender Neutral Language Recognizer", a student final project for Automata and Language Theory (BSCS 3B).',
      'The app is a static web page written in HTML, CSS and JavaScript. It reads .txt, .docx (mammoth.js) and .pdf (pdf.js) files.',
      'It finds gender-specific terms with a hand-built deterministic finite automaton (a trie with 125 states, alphabet a-z and space, case-insensitive, whole-word, longest match, space self-loop for phrases like "cleaning lady"). It does not use regular expressions to match terms, and it never rewrites the document: it only shows counts, highlights and suggestions.',
      'The 24 terms and suggestions are: ' + list + '.',
      'Answer questions about how the app works, finite automata, and why gender-neutral language matters.',
      'Talk like a friendly teammate who helped build this project, explaining it to a classmate over coffee. Use warm, natural, everyday words and short sentences. Speak in the first person ("we built it so...", "I would think of it like..."). Use a small everyday example or comparison when it helps, such as a board game or a path on a map. Give 2 to 4 sentences, never more than about 90 words.',
      'Write plain text only: no headings, no bullet lists, no markdown, no asterisks, no emojis, and do not start with "Great question". Never say you are an AI model. If you are not sure about something, say so honestly instead of guessing. If a question is unrelated to this project, kindly say you can only help with this project and steer back to it.',
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
    let lastErr;
    for (const model of MODELS) {
      let res;
      try {
        res = await doFetch(URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
          body: JSON.stringify(Object.assign({ model, messages, temperature: 0.4, max_tokens: 700 }, model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {})),
        });
      } catch (err) {
        throw new Error('Could not reach Groq. Check your internet connection.');
      }
      if (res.status === 401) throw new Error('That API key was rejected. Check it and try again.');
      if (res.status === 429) throw new Error('Too many requests right now. Wait a moment and try again.');
      if (!res.ok) {
        const err = new Error('Groq could not answer right now. Please try again.');
        err.status = res.status;
        try { err.detail = String(((await res.json()).error || {}).message || '').slice(0, 300); } catch (x) { err.detail = ''; }
        if (res.status === 404) { lastErr = err; continue; }
        throw err;
      }
      const data = await res.json();
      const text = String((data.choices[0].message || {}).content || '').trim();
      if (!text) { lastErr = new Error('Groq could not answer right now. Please try again.'); continue; }
      return text;
    }
    throw lastErr;
  }

  // Validate what the browser sends to the shared server-side helper.
  function sanitizeRequest(body) {
    const question = typeof (body && body.question) === 'string' ? body.question.trim() : '';
    if (!question) throw new Error('Please type a question.');
    if (question.length > 500) throw new Error('That question is too long. Keep it under 500 characters.');
    const history = (Array.isArray(body.history) ? body.history : [])
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map(m => ({ role: m.role, content: m.content.slice(0, 1000) }))
      .slice(-MAX_HISTORY);
    return { question, history };
  }

  // Ask the shared helper (a serverless function that holds the Groq key).
  async function askProxy({ question, history, fetchImpl, endpoint }) {
    const doFetch = fetchImpl || globalThis.fetch;
    let res;
    try {
      res = await doFetch(endpoint || '/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history }),
      });
    } catch (err) {
      const e = new Error('Could not reach the helper.');
      e.code = 'NO_PROXY';
      throw e;
    }
    if (res.status === 404 || res.status === 405) {
      const e = new Error('The shared helper is not available here.');
      e.code = 'NO_PROXY';
      throw e;
    }
    if (res.status === 429) throw new Error('Too many requests right now. Wait a moment and try again.');
    if (!res.ok) throw new Error('Groq could not answer right now. Please try again.');
    return (await res.json()).reply;
  }

  return { URL, MODEL, buildMessages, askGroq, sanitizeRequest, askProxy };
});
