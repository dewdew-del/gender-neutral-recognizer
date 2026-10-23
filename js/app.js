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
