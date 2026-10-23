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
