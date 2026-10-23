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

  function clearOutput() {
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
    $('fsa-summary').textContent = dfa.states + ' states · ' + accepting + ' accepting states · Σ = {a–z, ␣}. ' +
      'Any missing transition goes to an implicit dead state; states entered on ␣ loop on ␣ so phrases match across extra spaces and line breaks.';

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

  function renderTrace() {
    const out = $('trace-output');
    out.textContent = '';
    const word = $('trace-input').value;
    if (word === '') return;
    const t = FSA.trace(dfa, word);
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
  $('jump-automaton').addEventListener('click', () => { $('automaton').open = true; });

  // Floating mini windows (one open at a time)
  const floats = ['why', 'team', 'ask'].map(name => $('float-' + name));
  function closeFloats() { floats.forEach(f => { f.hidden = true; }); }
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
  const KEY_STORE = 'gnr-groq-key';
  function loadKey() { try { return localStorage.getItem(KEY_STORE) || ''; } catch (e) { return ''; } }
  function saveKey(v) { try { if (v) localStorage.setItem(KEY_STORE, v); else localStorage.removeItem(KEY_STORE); } catch (e) { /* storage unavailable */ } }
  let apiKey = loadKey();
  const chatLog = $('chat-log');
  const history = [];

  function addMsg(kind, text) {
    const m = el('div', text);
    m.className = 'msg ' + kind;
    chatLog.appendChild(m);
    chatLog.scrollTop = chatLog.scrollHeight;
    return m;
  }
  addMsg('bot', 'Hi! Ask me how the recognizer works, what a DFA is, or why gender-neutral wording matters.');
  $('key-box').open = !apiKey;

  $('key-form').addEventListener('submit', (e) => {
    e.preventDefault();
    apiKey = $('key-input').value.trim();
    saveKey(apiKey);
    $('key-input').value = '';
    if (apiKey) { $('key-box').open = false; addMsg('bot', 'Key saved in this browser.'); }
  });
  $('key-clear').addEventListener('click', () => { apiKey = ''; saveKey(''); $('key-input').value = ''; addMsg('bot', 'Key removed.'); });

  async function ask(question) {
    addMsg('user', question);
    $('chat-chips').hidden = true;
    if (!apiKey) { addMsg('err', 'Please enter your Groq API key first.'); $('key-box').open = true; return; }
    const send = $('chat-send');
    send.disabled = true;
    const thinking = addMsg('bot', '…');
    try {
      const reply = await Assistant.askGroq({ key: apiKey, messages: Assistant.buildMessages(question, history, TERMS) });
      thinking.textContent = reply;
      history.push({ role: 'user', content: question }, { role: 'assistant', content: reply });
    } catch (err) {
      thinking.remove();
      addMsg('err', err.message);
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
      const matches = FSA.scan(dfa, text);
      if (matches.length === 0) {
        showMessage('info', DocReader.MESSAGES.NO_TERMS);
      } else {
        showResults(FSA.summarize(matches, TERMS));
      }
      showPreview(text, matches);
    } catch (err) {
      showMessage('error', err.message);
    }
  });
})();
