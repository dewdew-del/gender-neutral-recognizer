(function () {
  const dfa = FSA.buildDFA(TERMS);
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';

  const $ = (id) => document.getElementById(id);
  const fileInput = $('file-input');
  const fileName = $('file-name');
  const message = $('message');
  const resultsSection = $('results-section');
  const resultsBody = $('results-body');
  const resultsTotal = $('results-total');
  const previewSection = $('preview-section');
  const preview = $('preview');

  function el(tag, text) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function showMessage(kind, text) {
    message.className = kind;
    message.textContent = text;
    message.hidden = false;
  }

  // "Your document through the automaton": what the machine did with the uploaded text
  function pill(text, onClick, cls) {
    const b = el('button', text);
    b.type = 'button';
    b.className = 'pill' + (cls ? ' ' + cls : '');
    if (onClick) b.addEventListener('click', onClick); else b.disabled = true;
    return b;
  }
  // the whole word around a near miss, e.g. "shell" for the accepting state of "she"
  function fullWord(text, m) {
    let end = m.end;
    while (end < text.length && /[\p{L}\p{N}]/u.test(text[end])) end++;
    return text.slice(m.start, end);
  }
  function showDocAutomaton(text, analysis) {
    const box = $('doc-fsa');
    const tidy = (s) => s.replace(/\s+/g, ' ');
    $('ds-chars').textContent = String(analysis.chars);
    $('ds-words').textContent = String(analysis.words);
    $('ds-match').textContent = String(analysis.matches.length);
    $('ds-miss').textContent = String(analysis.nearMisses.length);
    $('doc-note').textContent = 'The machine restarted at q0 at the beginning of each of the ' + analysis.words +
      ' words and followed one arrow per letter. A word whose letters have no arrow stops at the dead state ∅.';
    const ok = $('doc-matches');
    ok.textContent = '';
    analysis.matches.slice(0, 60).forEach((m) => {
      const word = text.slice(m.start, m.end);
      ok.appendChild(pill(tidy(word) + ' → ' + TERMS[m.termIndex].suggestion, () => showTrace(tidy(word)), 'good'));
    });
    if (analysis.matches.length > 60) ok.appendChild(el('span', '… and ' + (analysis.matches.length - 60) + ' more'));
    if (!analysis.matches.length) ok.appendChild(el('span', 'None in this document.'));
    const bad = $('doc-misses');
    bad.textContent = '';
    const seen = new Set();
    for (const m of analysis.nearMisses) {
      let end = m.end;
      while (end < text.length && /[\p{L}\p{N}]/u.test(text[end])) end++;
      const full = text.slice(m.start, end);
      const key = full.toLowerCase();
      if (seen.has(key) || seen.size >= 20) continue;
      seen.add(key);
      bad.appendChild(pill('"' + full + '" reached "' + TERMS[m.termIndex].term + '" but is longer', () => showTrace(tidy(full)), 'warn'));
    }
    if (!analysis.nearMisses.length) bad.appendChild(el('span', 'No near misses in this document.'));
    box.hidden = false;

    // Trace panel starts from the uploaded document instead of the default example
    let first = null, why = '';
    if (analysis.matches.length) { const m = analysis.matches[0]; first = tidy(text.slice(m.start, m.end)); why = 'the first term found in your document'; }
    else if (analysis.nearMisses.length) { const m = analysis.nearMisses[0]; first = tidy(fullWord(text, m)); why = 'the first near miss in your document'; }
    else { const w = text.match(/[\p{L}\p{N}]+/u); if (w) { first = w[0]; why = 'the first word of your document'; } }
    if (first) {
      $('trace-input').value = first;
      $('trace-title').textContent = 'Path through the automaton for ' + why;
      renderTrace();
    }
  }

  // Editable corrected copy (the original file is never changed)
  let docText = '', docMatches = [], docName = 'document';
  const editorSection = $('editor-section');
  const editor = $('editor');
  const editorStatus = $('editor-status');
  const openEditorBtn = $('open-editor');
  function fillEditor() { editor.value = Render.applySuggestions(docText, docMatches, TERMS); }
  function say(msg) { editorStatus.textContent = msg; setTimeout(() => { if (editorStatus.textContent === msg) editorStatus.textContent = ''; }, 3000); }
  openEditorBtn.addEventListener('click', () => {
    fillEditor();
    editorSection.hidden = false;
    editorSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    editor.focus();
  });
  $('reset-editor').addEventListener('click', () => { fillEditor(); say('Reset to the suggestions.'); });
  $('copy-text').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(editor.value); say('Copied.'); } catch (e) { editor.select(); say('Press Ctrl+C to copy.'); }
  });
  $('dl-txt').addEventListener('click', () => {
    const blob = new Blob([editor.value], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = docName.replace(/\.[^.]*$/, '') + '-corrected.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    say('Downloaded ' + a.download);
  });

  function clearOutput() {
    editorSection.hidden = true;
    openEditorBtn.hidden = true;
    $('doc-fsa').hidden = true;
    $('trace-title').textContent = 'Try a word or phrase';
    message.hidden = true;
    message.textContent = '';
    resultsSection.hidden = true;
    resultsBody.textContent = '';
    resultsTotal.textContent = '';
    previewSection.hidden = true;
    preview.textContent = '';
  }

  function showPreview(text, matches) {
    preview.textContent = '';
    for (const seg of Render.toSegments(text, matches, TERMS)) {
      if (seg.term) {
        const mark = el('mark', seg.text);
        mark.title = 'Suggestion: ' + seg.suggestion;
        mark.dataset.suggestion = seg.suggestion;
        preview.appendChild(mark);
      } else {
        preview.appendChild(document.createTextNode(seg.text));
      }
    }
    previewSection.hidden = false;
  }

  function showResults(summary) {
    summary.forEach((row, i) => {
      const tr = el('tr');
      tr.appendChild(el('td', String(i + 1)));
      tr.appendChild(el('td', row.term));
      tr.appendChild(el('td', String(row.count)));
      tr.appendChild(el('td', row.suggestion));
      tr.tabIndex = 0;
      tr.title = 'Click to see how the automaton recognized this term';
      tr.addEventListener('click', () => showTrace(row.term));
      tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') showTrace(row.term); });
      resultsBody.appendChild(tr);
    });
    const total = summary.reduce((n, r) => n + r.count, 0);
    const tr = el('tr');
    const label = el('td', 'Total occurrences');
    label.colSpan = 2;
    tr.appendChild(label);
    tr.appendChild(el('td', String(total)));
    tr.appendChild(el('td', ''));
    resultsTotal.appendChild(tr);
    $('stat-terms').textContent = String(summary.length);
    $('stat-total').textContent = String(total);
    resultsSection.hidden = false;
  }

  const q = (n) => 'q' + n;

  function renderAutomatonPanel() {
    const rows = FSA.transitionRows(dfa, TERMS);
    const accepting = rows.filter(r => r.accepting).length;
    $('fsa-summary').textContent = 'Type any word. Watch it move through the states: a double ring at the end means accepted, ∅ means rejected. The ' + accepting + ' accepting states are the 24 terms.';

    const table = el('table');
    const head = el('tr');
    ['State', 'Transitions', 'Accepts'].forEach(h => head.appendChild(el('th', h)));
    table.appendChild(el('thead')).appendChild(head);
    const body = el('tbody');
    for (const r of rows) {
      const tr = el('tr');
      tr.appendChild(el('td', q(r.state) + (r.accepting ? ' ◎' : '')));
      tr.appendChild(el('td', r.transitions.map(([s, n]) => (s === ' ' ? '␣' : s) + ' → ' + q(n)).join(', ')));
      tr.appendChild(el('td', r.term || ''));
      body.appendChild(tr);
    }
    table.appendChild(body);
    $('transition-table').appendChild(table);
  }

  function renderFormal() {
    const rows = FSA.transitionRows(dfa, TERMS);
    const edges = rows.reduce((n, r) => n + r.transitions.length, 0);
    const t = $('fsa-formal');
    t.textContent = '';
    [
      ['M', '(Q, Σ, δ, q0, F)'],
      ['Q', 'a set of ' + dfa.states + ' states, q0 … q' + (dfa.states - 1) + ', plus an implicit dead state ∅'],
      ['Σ', '{ a, b, …, z, ␣ }, the 26 lowercase letters and the space symbol'],
      ['δ', 'the transition function, ' + edges + ' arrows q —symbol→ q′; any missing arrow goes to ∅'],
      ['q0', 'the start state'],
      ['F', 'the ' + rows.filter(r => r.accepting).length + ' accepting states, one for each of the 24 terms'],
    ].forEach(([k, v]) => { const tr = el('tr'); tr.appendChild(el('th', k)); tr.appendChild(el('td', v)); t.appendChild(tr); });
  }

  function renderDiagram(word, t) {
    const box = $('fsa-diagram');
    box.textContent = '';
    if (word === '') return;
    const show = (s) => (s === ' ' ? '␣' : s);
    const state = (label, cls, i) => { const s = el('span', label); s.className = 'st ' + cls; s.style.animationDelay = (i * 0.12) + 's'; return s; };
    const arrow = (sym, i) => { const s = el('span', show(sym) + ' →'); s.className = 'ar'; s.style.animationDelay = (i * 0.12 - 0.06) + 's'; return s; };
    let i = 0;
    box.appendChild(state('q0', 'start', i++));
    t.path.forEach((step, k) => {
      box.appendChild(arrow(step.symbol, i));
      const isLast = k === t.path.length - 1;
      if (step.to === null) box.appendChild(state('∅', 'dead', i++));
      else box.appendChild(state(q(step.to), isLast ? (t.accepted ? 'accept' : 'stop') : '', i++));
    });
  }

  function renderSteps(t) {
    const tb = $('fsa-steps');
    tb.textContent = '';
    if (!t.path.length) return;
    const head = el('tr');
    ['Step', 'From', 'Reads', 'To'].forEach(x => head.appendChild(el('th', x)));
    tb.appendChild(head);
    t.path.forEach((s, k) => {
      const tr = el('tr');
      tr.appendChild(el('td', String(k + 1)));
      tr.appendChild(el('td', q(s.from)));
      tr.appendChild(el('td', s.symbol === ' ' ? '␣' : s.symbol));
      tr.appendChild(el('td', s.to === null ? '∅ (dead)' : q(s.to)));
      tb.appendChild(tr);
    });
  }

  function renderTrace() {
    const out = $('trace-output');
    out.textContent = '';
    const word = $('trace-input').value;
    if (word === '') { $('fsa-diagram').textContent = ''; $('fsa-steps').textContent = ''; return; }
    const t = FSA.trace(dfa, word);
    renderDiagram(word, t);
    renderSteps(t);
    const show = (s) => (s === ' ' ? '␣' : s);
    let line = 'q0';
    for (const step of t.path) {
      line += ' —' + show(step.symbol) + '→ ' + (step.to === null ? '∅' : q(step.to));
    }
    out.appendChild(el('div', line));
    const last = t.path[t.path.length - 1];
    let verdict;
    if (t.accepted) {
      const term = TERMS[t.termIndex];
      verdict = el('div', '✔ Accepted: ' + term.term + ' → ' + term.suggestion);
      verdict.className = 'accepted';
    } else if (last.to === null) {
      verdict = el('div', "✘ Rejected (dead state after '" + show(last.symbol) + "')");
      verdict.className = 'rejected';
    } else {
      verdict = el('div', '✘ Rejected (' + q(last.to) + ' is not accepting)');
      verdict.className = 'rejected';
    }
    out.appendChild(verdict);
  }

  renderAutomatonPanel();
  renderFormal();
  $('trace-input').addEventListener('input', renderTrace);
  renderTrace();

  const dropZone = $('drop-zone');
  ['dragenter', 'dragover'].forEach(ev => dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(ev => dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); }));
  dropZone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      fileInput.dispatchEvent(new Event('change'));
    }
  });
  document.querySelectorAll('.avatar img').forEach(img => {
    if (img.complete && img.naturalWidth === 0) img.remove();
    else img.addEventListener('error', () => img.remove());
  });

  // Light / dark switch (follows the system until the user picks one)
  const root = document.documentElement;
  const themeBtn = $('theme-toggle');
  const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  function paintThemeBtn() { themeBtn.textContent = isDark() ? 'Light' : 'Dark'; }
  try { const saved = localStorage.getItem('gnr-theme'); if (saved === 'light' || saved === 'dark') root.dataset.theme = saved; } catch (e) { /* storage unavailable */ }
  paintThemeBtn();
  themeBtn.addEventListener('click', () => {
    root.dataset.theme = isDark() ? 'light' : 'dark';
    try { localStorage.setItem('gnr-theme', root.dataset.theme); } catch (e) { /* storage unavailable */ }
    paintThemeBtn();
  });

  // Floating mini windows (one open at a time)
  const floats = ['how', 'why', 'team', 'ask'].map(name => $('float-' + name));
  function closeFloats() { floats.forEach(f => { f.hidden = true; }); }
  // Open "How it works" with the automaton trace of the clicked term
  function showTrace(term) {
    closeFloats();
    $('trace-input').value = term;
    renderTrace();
    $('automaton-section').open = true;
    $('automaton-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('goto-automaton').addEventListener('click', (e) => { e.preventDefault(); closeFloats(); $('automaton-section').open = true; $('automaton-section').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  document.querySelectorAll('[data-open]').forEach(btn => btn.addEventListener('click', () => {
    const target = $('float-' + btn.dataset.open);
    const wasOpen = !target.hidden;
    closeFloats();
    if (!wasOpen) {
      target.hidden = false;
      if (btn.dataset.open === 'ask') $('chat-input').focus();
    }
  }));
  document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', closeFloats));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeFloats(); });

  // Question helper (Groq)
  const chatLog = $('chat-log');
  const history = [];

  function addMsg(kind, text) {
    const m = el('div', text);
    m.className = 'msg ' + kind;
    chatLog.appendChild(m);
    chatLog.scrollTop = chatLog.scrollHeight;
    return m;
  }
  addMsg('bot', 'Hi! I can explain how this works, what a DFA is, or why neutral wording matters. Ask me anything, even the silly stuff.');


  async function ask(question) {
    addMsg('user', question);
    $('chat-chips').hidden = true;
    const send = $('chat-send');
    send.disabled = true;
    const thinking = addMsg('bot', '…');
    try {
      const reply = await Assistant.askProxy({ question, history });
      const clean = String(reply).replace(/\*\*|__|`/g, '');
      thinking.textContent = clean;
      history.push({ role: 'user', content: question }, { role: 'assistant', content: clean });
    } catch (err) {
      thinking.remove();
      if (err.code === 'NO_PROXY') {
        addMsg('err', 'The question helper is not available right now. Please try again later.');
      } else {
        addMsg('err', err.message);
      }
    } finally {
      send.disabled = false;
    }
  }
  $('chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = $('chat-input').value.trim();
    if (!q) return;
    $('chat-input').value = '';
    ask(q);
  });
  document.querySelectorAll('.chip').forEach(chip => chip.addEventListener('click', () => ask(chip.textContent)));

  fileInput.addEventListener('change', async () => {
    clearOutput();
    const file = fileInput.files[0];
    if (!file) { fileName.textContent = ''; return; }
    fileName.textContent = file.name;
    try {
      const text = await DocReader.readFile(file);
      const analysis = FSA.analyze(dfa, text);
      const matches = analysis.matches;
      showDocAutomaton(text, analysis);
      if (matches.length === 0) {
        showMessage('info', DocReader.MESSAGES.NO_TERMS);
      } else {
        showResults(FSA.summarize(matches, TERMS));
      }
      showPreview(text, matches);
      docText = text; docMatches = matches; docName = file.name;
      openEditorBtn.hidden = matches.length === 0;
    } catch (err) {
      showMessage('error', err.message);
    }
  });
})();
