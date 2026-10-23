# Gender Neutral Language Recognizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static web page that reads a .txt/.docx/.pdf file, finds 24 predefined gender-specific terms with a hand-built DFA (case-insensitive, whole-word), and shows a results table, a highlighted preview, and an automaton panel.

**Architecture:** Plain HTML/CSS/JS with no build step. The logic modules (`terms.js`, `fsa.js`, `render.js`, `fileReader.js`) are DOM-free and dual-exported, so they work as browser globals and as Node `module.exports`. They are unit-tested with `node --test`. `app.js` only wires the page together.

**Tech Stack:** HTML5, CSS, vanilla JavaScript (ES2020), Node 24 `node:test` for unit tests, mammoth.js 1.8.0 (.docx), pdf.js 3.11.174 (.pdf), git + GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-23-gender-neutral-recognizer-design.md`

**Schedule (3 days):** Day 1 = Tasks 1–3 · Day 2 = Tasks 4–5 · Day 3 = Tasks 6–7.

## Global Constraints

- Repo root: `automata project/gender-neutral-recognizer/`. All paths below are relative to it.
- No regex for **matching terms**. Recognition runs through the DFA only. Regex is allowed for character classes (`/[\p{L}\p{N}]/u`, `/\s/`) and for file extensions.
- Alphabet Σ = { a–z, space }. Each character is lowercased first. Any whitespace maps to the space symbol `' '`. Everything else has no transition (dead state).
- Word character = `/[\p{L}\p{N}]/u`. Everything else is a boundary.
- Exact messages (copy verbatim):
  - `UNSUPPORTED`: "Unsupported file format. Please upload a .txt, .docx, or .pdf file."
  - `EMPTY`: "The file is empty. Please upload a file that contains text."
  - `UNREADABLE`: "The file could not be read. It may be damaged or password-protected."
  - `NO_TERMS`: "No predefined gender-specific terms were detected."
- Browser globals: `TERMS`, `FSA`, `Render`, `DocReader`. Never name anything `FileReader`, because that is a built-in browser API.
- Document text reaches the page only through `textContent` / `createTextNode`, never `innerHTML`.
- Display state numbers as `q0`, `q1`, … and the space symbol as `␣`.
- Dual-export wrapper for every logic module:
  ```js
  (function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.NAME = api;
  })(typeof self !== 'undefined' ? self : this, function () { /* ... */ return api; });
  ```
  `NAME` is `FSA`, `Render`, or `DocReader`. `terms.js` is the one exception: its `api` is `{ TERMS }`, and in the browser it sets `root.TERMS = api.TERMS`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Document text that looks like HTML** (`<b>he</b>`, `<script>`) must show up literally in the preview and never run. Covered by the global `textContent` rule and a manual check in Task 5, Step 6.
2. **Phrases split by a line break, a tab, or extra spaces** (`cleaning\r\nlady`, `cleaning  lady`) should still match. Covered by the space self-loop and tests in Task 1 and Task 2.
3. **Uppercase or double extensions** (`NOTES.TXT`, `report.txt.pdf`) are treated by their final extension. No extension means unsupported. Covered by tests in Task 4.
4. **A UTF-8 byte-order mark (BOM) at the start of a .txt file** (`﻿He said`) must not hide the first word. Covered by a test in Task 2.
5. **A large file** (about 1 MB of text) must scan in under 1 second. Covered by a test in Task 2.

---

### Task 1: Repo setup, term list, DFA construction

**Files:**
- Create: `.gitignore` (`node_modules/`), `js/terms.js`, `js/fsa.js`, `tests/fsa.test.js`

**Interfaces:**
- Produces:
  - `TERMS: Array<{ term: string, suggestion: string }>`: the 24 rows from spec §4, in that order, all lowercase. The browser global is `root.TERMS`; Node gets `module.exports = { TERMS }`.
  - `FSA.buildDFA(terms) → { start: 0, delta: Array<Object<string, number>>, accept: Object<number, number>, states: number }`. States are integers. `delta[s][sym]` is the next state, and a missing entry means dead. `accept[s]` is an index into `terms`. The browser global is `root.FSA`; Node gets `module.exports = { buildDFA, ... }`.
  - `FSA.sym(ch) → string | null`: lowercase letter a–z, `' '` for whitespace, `null` otherwise.

- [ ] **Step 1: Initialize the repo**

```bash
cd "automata project/gender-neutral-recognizer" && git init && git branch -m main
```

- [ ] **Step 2: Write the failing tests** in `tests/fsa.test.js`

```js
const test = require('node:test');
const assert = require('node:assert');
const { TERMS } = require('../js/terms.js');
const FSA = require('../js/fsa.js');

test('term list has 24 lowercase terms with suggestions', () => {
  assert.strictEqual(TERMS.length, 24);
  for (const t of TERMS) {
    assert.strictEqual(t.term, t.term.toLowerCase());
    assert.ok(t.suggestion.length > 0);
  }
});

test('sym maps letters, whitespace, and others', () => {
  assert.strictEqual(FSA.sym('A'), 'a');
  assert.strictEqual(FSA.sym('\t'), ' ');
  assert.strictEqual(FSA.sym('\r'), ' ');
  assert.strictEqual(FSA.sym(','), null);
  assert.strictEqual(FSA.sym('é'), null);
});

test('buildDFA shares prefixes and marks accepting states', () => {
  const dfa = FSA.buildDFA([{ term: 'he' }, { term: 'her' }, { term: 'him' }]);
  // q0 -h-> q1 -e-> q2(he) -r-> q3(her);  q1 -i-> q4 -m-> q5(him)
  assert.strictEqual(dfa.states, 6);
  const h = dfa.delta[0]['h'];
  const he = dfa.delta[h]['e'];
  assert.strictEqual(dfa.accept[he], 0);
  assert.strictEqual(dfa.accept[dfa.delta[he]['r']], 1);
  assert.strictEqual(dfa.delta[0]['t'], undefined);   // dead
});

test('states entered on space loop on space', () => {
  const dfa = FSA.buildDFA([{ term: 'cleaning lady' }]);
  let s = 0;
  for (const c of 'cleaning ') s = dfa.delta[s][c];
  assert.strictEqual(dfa.delta[s][' '], s);
});
```

- [ ] **Step 3: Run the tests and check they fail**

Run: `node --test tests/`
Expected: FAIL with "Cannot find module '../js/terms.js'"

- [ ] **Step 4: Implement `js/terms.js`** with the 24 rows from spec §4 (term → suggestion), in the dual-export wrapper.

- [ ] **Step 5: Implement `sym(ch)` and `buildDFA(terms)` in `js/fsa.js`**

`buildDFA` builds a trie: walk each term with `sym()` and create a state where a transition is missing. When the symbol is `' '`, also set `delta[next][' '] = next`, which is the self-loop. Mark the final state's `accept` entry.

- [ ] **Step 6: Run the tests and check they pass**

Run: `node --test tests/`
Expected: 4 tests pass, 0 fail

- [ ] **Step 7: Commit**

```bash
git add .gitignore js/terms.js js/fsa.js tests/fsa.test.js docs
git commit -m "feat: term list and DFA construction"
```

---

### Task 2: Scanning and summary

**Files:**
- Modify: `js/fsa.js`
- Test: `tests/fsa.test.js`

**Interfaces:**
- Consumes: `buildDFA`, `sym`, `TERMS` (Task 1)
- Produces:
  - `FSA.scan(dfa, text) → Array<{ termIndex: number, start: number, end: number }>`: in text order, with `end` exclusive, as indices into the original `text`.
  - `FSA.summarize(matches, terms) → Array<{ term, suggestion, count }>`: in order of first occurrence.

- [ ] **Step 1: Write the failing tests** (append to `tests/fsa.test.js`)

```js
const dfa = FSA.buildDFA(TERMS);
const found = (text) => FSA.scan(dfa, text).map(m => TERMS[m.termIndex].term);

test('every term matches on its own', () => {
  for (const t of TERMS) assert.deepStrictEqual(found(t.term), [t.term]);
});
test('"he" is not found inside other words', () => {
  assert.deepStrictEqual(found('the there other hello shell'), []);
});
test('case-insensitive counting', () => {
  const s = FSA.summarize(FSA.scan(dfa, 'CHAIRMAN Chairman chairman'), TERMS);
  assert.deepStrictEqual(s, [{ term: 'chairman', suggestion: 'chairperson', count: 3 }]);
});
test('longest match wins', () => {
  assert.deepStrictEqual(found('herself hers her he'), ['herself', 'hers', 'her', 'he']);
});
test('punctuation and apostrophes are boundaries', () => {
  assert.deepStrictEqual(found('fireman, (she) he\'s he’s he—she'), ['fireman', 'she', 'he', 'he', 'he', 'she']);
});
test('phrases match across extra whitespace and CRLF', () => {
  assert.deepStrictEqual(found('cleaning lady'), ['cleaning lady']);
  assert.deepStrictEqual(found('cleaning  lady'), ['cleaning lady']);
  assert.deepStrictEqual(found('cleaning\r\nlady'), ['cleaning lady']);
  assert.deepStrictEqual(found('cleaning'), []);
});
test('match positions point into the original text', () => {
  assert.deepStrictEqual(FSA.scan(dfa, 'The Chairman.'), [{ termIndex: 0, start: 4, end: 12 }]);
});
test('leading BOM does not hide the first word', () => {
  assert.deepStrictEqual(found('﻿He said'), ['he']);
});
test('empty text has no matches', () => {
  assert.deepStrictEqual(FSA.scan(dfa, ''), []);
});
test('1 MB of text scans in under 1 second', () => {
  const big = 'The chairman said that he and the other firefighters left. '.repeat(17000);
  const t0 = Date.now();
  FSA.scan(dfa, big);
  assert.ok(Date.now() - t0 < 1000);
});
```

- [ ] **Step 2: Run the tests and check they fail**

Run: `node --test tests/`
Expected: the new tests FAIL with "FSA.scan is not a function"

- [ ] **Step 3: Implement `scan` and `summarize` in `js/fsa.js`**

`scan` follows the pseudocode in spec §5 "Scanning" exactly. A word start is `i === 0 || !isWordChar(text[i-1])`. Accept only when `j === text.length || !isWordChar(text[j])`. Keep the longest accept and resume at `best.end`. Export `isWordChar` too.

- [ ] **Step 4: Run the tests and check they pass**

Run: `node --test tests/`
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add js/fsa.js tests/fsa.test.js
git commit -m "feat: whole-word case-insensitive DFA scan and summary"
```

---

### Task 3: Trace, transition table, and the doc-team handoff

**Files:**
- Modify: `js/fsa.js`
- Test: `tests/fsa.test.js`
- Create: `docs/for-documentation-team.md`

**Interfaces:**
- Consumes: `buildDFA`, `sym` (Task 1)
- Produces:
  - `FSA.trace(dfa, word) → { path: Array<{ from: number, symbol: string, to: number | null }>, accepted: boolean, termIndex: number | null }`. `symbol` is the raw input character. `to: null` means dead, and the path stops there. `accepted` is true when every character is consumed and the last state is accepting.
  - `FSA.transitionRows(dfa, terms) → Array<{ state: number, transitions: Array<[string, number]>, accepting: boolean, term: string | null }>`, sorted by state, with transitions sorted by symbol.

- [ ] **Step 1: Write the failing tests**

```js
test('trace accepts fireman and shows its path', () => {
  const t = FSA.trace(dfa, 'Fireman');
  assert.strictEqual(t.accepted, true);
  assert.strictEqual(TERMS[t.termIndex].term, 'fireman');
  assert.strictEqual(t.path.length, 7);
  assert.strictEqual(t.path[0].from, 0);
});
test('trace rejects "the" at the first symbol', () => {
  const t = FSA.trace(dfa, 'the');
  assert.strictEqual(t.accepted, false);
  assert.deepStrictEqual(t.path, [{ from: 0, symbol: 't', to: null }]);
});
test('trace rejects a proper prefix like "chair"', () => {
  assert.strictEqual(FSA.trace(dfa, 'chair').accepted, false);
});
test('transitionRows lists every state once', () => {
  const rows = FSA.transitionRows(dfa, TERMS);
  assert.strictEqual(rows.length, dfa.states);
  assert.strictEqual(rows.filter(r => r.accepting).length, 24);
  assert.ok(rows[0].transitions.some(([s]) => s === 'h'));
});
```

- [ ] **Step 2: Run the tests and check they fail**

Run: `node --test tests/`
Expected: FAIL with "FSA.trace is not a function"

- [ ] **Step 3: Implement `trace` and `transitionRows` in `js/fsa.js`**

- [ ] **Step 4: Run the tests and check they pass**

Run: `node --test tests/`
Expected: all tests pass

- [ ] **Step 5: Write `docs/for-documentation-team.md`** for document section 2. It contains:
  - the language and tools (HTML/CSS/JS, mammoth.js, pdf.js)
  - the approach (FSA/DFA) and why, in two sentences
  - the 24-term table
  - the alphabet, how the trie DFA is built, the dead state, the space self-loop, and the whole-word and case rules (summarized from spec §5)
  - the actual trace output for "fireman" (accepted) and "the" (rejected), printed with `node -e` from `trace()`
  - the total state count from `buildDFA(TERMS).states`
  - a note asking them to hand-draw the diagram for "fireman" and "he/her/hers/herself"

- [ ] **Step 6: Commit**

```bash
git add js/fsa.js tests/fsa.test.js docs/for-documentation-team.md
git commit -m "feat: DFA trace and transition table; doc-team handoff"
```

**End of Day 1:** send `docs/for-documentation-team.md` to the group.

---

### Task 4: File reading and validation

**Files:**
- Create: `js/fileReader.js`, `tests/fileReader.test.js`, `lib/mammoth.browser.min.js`, `lib/pdf.min.js`, `lib/pdf.worker.min.js`

**Interfaces:**
- Produces (browser global `root.DocReader`; Node `module.exports`):
  - `MESSAGES: { UNSUPPORTED, EMPTY, UNREADABLE, NO_TERMS }`: the exact strings from Global Constraints.
  - `getExtension(name: string) → string`: the lowercase final extension including the dot (`'.txt'`), or `''`.
  - `readFile(file: File) → Promise<string>`: rejects with `new Error(MESSAGES.X)`. It reads `globalThis.mammoth` and `globalThis.pdfjsLib` lazily, at call time, so tests can stub them.

- [ ] **Step 1: Write the failing tests** in `tests/fileReader.test.js` (Node 24 has a global `File`)

```js
const test = require('node:test');
const assert = require('node:assert');
const { MESSAGES, getExtension, readFile } = require('../js/fileReader.js');

test('getExtension', () => {
  assert.strictEqual(getExtension('NOTES.TXT'), '.txt');
  assert.strictEqual(getExtension('report.txt.pdf'), '.pdf');
  assert.strictEqual(getExtension('noext'), '');
});
test('reads .txt regardless of extension case', async () => {
  assert.strictEqual(await readFile(new File(['He left.'], 'A.TXT')), 'He left.');
});
test('unsupported formats are rejected', async () => {
  for (const n of ['a.rtf', 'a.doc', 'noext'])
    await assert.rejects(readFile(new File(['x'], n)), { message: MESSAGES.UNSUPPORTED });
});
test('empty and whitespace-only files are rejected', async () => {
  await assert.rejects(readFile(new File([''], 'e.txt')), { message: MESSAGES.EMPTY });
  await assert.rejects(readFile(new File([' \r\n\t'], 'w.txt')), { message: MESSAGES.EMPTY });
});
test('parser failures become UNREADABLE', async () => {
  globalThis.mammoth = { extractRawText: () => Promise.reject(new Error('bad zip')) };
  await assert.rejects(readFile(new File(['x'], 'a.docx')), { message: MESSAGES.UNREADABLE });
  globalThis.pdfjsLib = { getDocument: () => ({ promise: Promise.reject(new Error('bad pdf')) }) };
  await assert.rejects(readFile(new File(['x'], 'a.pdf')), { message: MESSAGES.UNREADABLE });
});
test('docx text comes from mammoth', async () => {
  globalThis.mammoth = { extractRawText: async () => ({ value: 'The chairman' }) };
  assert.strictEqual(await readFile(new File(['x'], 'a.docx')), 'The chairman');
});
```

- [ ] **Step 2: Run the tests and check they fail**

Run: `node --test tests/`
Expected: FAIL with "Cannot find module '../js/fileReader.js'"

- [ ] **Step 3: Implement `js/fileReader.js`**

- .txt: `file.text()`.
- .docx: `mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })` → `.value`.
- .pdf: `pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise`, then for pages 1..`numPages` call `getTextContent()`. Join the `items[].str` with `' '` and the pages with `'\n'`.

Order of checks:
1. Extension not supported → `UNSUPPORTED`.
2. `file.size === 0` → `EMPTY`.
3. Parse, and turn any parser error into `UNREADABLE`.
4. `text.trim() === ''` → `EMPTY`.

- [ ] **Step 4: Run the tests and check they pass**

Run: `node --test tests/`
Expected: all tests pass

- [ ] **Step 5: Vendor the libraries into `lib/`** so the demo works without internet

```bash
curl -fL -o lib/mammoth.browser.min.js https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js
curl -fL -o lib/pdf.min.js https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js
curl -fL -o lib/pdf.worker.min.js https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js
```

Expected: three files, each larger than 100 KB. If cdnjs 404s for mammoth, use `https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js`.

- [ ] **Step 6: Commit**

```bash
git add js/fileReader.js tests/fileReader.test.js lib
git commit -m "feat: txt/docx/pdf reading with validation messages"
```

---

### Task 5: Page, results table, preview

**Files:**
- Create: `js/render.js`, `tests/render.test.js`, `index.html`, `style.css`, `js/app.js`, `.claude/launch.json`

**Interfaces:**
- Consumes: `TERMS`, `FSA.buildDFA/scan/summarize`, `DocReader.readFile/MESSAGES`
- Produces:
  - `Render.toSegments(text, matches, terms) → Array<{ text: string, term?: string, suggestion?: string }>`. It covers all of `text` in order and returns `[]` for empty text. The browser global is `root.Render`.
  - DOM ids used by Task 6: `#fsa-summary`, `#trace-input`, `#trace-output`, `#transition-table` (empty placeholders inside `<details id="automaton">`).

- [ ] **Step 1: Write the failing test** in `tests/render.test.js`

```js
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
```

- [ ] **Step 2: Run the tests and check they fail**

Run: `node --test tests/`
Expected: FAIL with "Cannot find module '../js/render.js'"

- [ ] **Step 3: Implement `toSegments` in `js/render.js`**

- [ ] **Step 4: Run the tests and check they pass**

Run: `node --test tests/`
Expected: all tests pass

- [ ] **Step 5: Build `index.html`, `style.css`, `js/app.js`**

- **Script order:** `lib/mammoth.browser.min.js`, `lib/pdf.min.js`, then `js/terms.js`, `js/fsa.js`, `js/render.js`, `js/fileReader.js`, `js/app.js`. In `app.js`, set `pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js'`.
- **Layout (spec §7):**
  - header
  - `<input type="file" id="file-input" accept=".txt,.docx,.pdf">` and `#file-name`
  - `#message` with the `info` or `error` class
  - `<table id="results">` with columns # / Gender-specific term / Occurrences / Suggested alternative, a `<tbody id="results-body">`, and a `<tfoot id="results-total">` showing the total occurrences
  - `<pre id="preview">` with `<mark title="Suggestion: …">` for matches
  - the empty `<details id="automaton">` placeholders listed in Interfaces
- **`app.js` flow:** build `dfa` once at load. On `change`: clear the old output, show the file name, `await readFile`, then `scan` → `summarize`.
  - No matches: show `MESSAGES.NO_TERMS` (info) and hide the table, but still show the preview.
  - Matches: fill the table and the preview from `toSegments`.
  - A rejected read: show `err.message` (error) and hide the table and preview.
- Text goes in through `textContent` / `createTextNode` only.

- [ ] **Step 6: Check it in the browser**

Create `.claude/launch.json`:

```json
{ "version": "0.0.1", "configurations": [
  { "name": "app", "runtimeExecutable": "npx", "runtimeArgs": ["--yes", "serve", "-l", "5173", "."], "port": 5173 } ] }
```

Start it with `preview_start` name `app`, then upload test files you make on the spot:
- `He met the chairman. The Chairman left.`: table rows he 1, chairman 2; total 3.
- `The weather is fine.`: the NO_TERMS message.
- A 0-byte .txt: EMPTY. A `.rtf`: UNSUPPORTED.
- `<b>he</b> <script>alert(1)</script>`: the preview shows the tags literally, there's no alert, and "he" is highlighted.
- The browser console shows no errors.

- [ ] **Step 7: Commit**

```bash
git add js/render.js tests/render.test.js index.html style.css js/app.js .claude/launch.json
git commit -m "feat: upload page with results table and highlighted preview"
```

---

### Task 6: Automaton panel

**Files:**
- Modify: `js/app.js`, `style.css`

**Interfaces:**
- Consumes: `FSA.trace`, `FSA.transitionRows` (Task 3); the DOM ids from Task 5

- [ ] **Step 1: Render the panel at load**
  - `#fsa-summary`: "N states · 24 accepting states · Σ = {a–z, ␣}", plus a one-line note on the dead state and the space self-loop.
  - `#transition-table`: one row per `transitionRows` entry, with columns State (`q12`, plus a double-circle marker ◎ when accepting) / Transitions (`f → q9, h → q14`) / Accepts (term or blank).
  - `#trace-input` (a text input) updates `#trace-output` on every `input` event. It shows the path as `q0 —f→ q9 —i→ q10 … ` and then "✔ Accepted: fireman → firefighter" or "✘ Rejected (dead state after 't')" / "✘ Rejected (q4 is not accepting)". It starts filled with `fireman`.

- [ ] **Step 2: Check it in the browser**

Reload the `app` preview and open the Automaton panel. Check these traces:
- `fireman` shows 7 steps, accepted.
- `the` is rejected at `t`.
- `chair` is rejected because it ends in a non-accepting state.
- `cleaning  lady` (two spaces) is accepted.

Also check that the state count matches the value written in `docs/for-documentation-team.md`.

- [ ] **Step 3: Commit**

```bash
git add js/app.js style.css
git commit -m "feat: automaton panel with trace and transition table"
```

---

### Task 7: Samples, README, publish

**Files:**
- Create: `samples/1-with-terms.txt`, `samples/2-repeated-mixed-case.txt`, `samples/3-no-terms.txt`, `samples/4-empty.txt`, `samples/5-unsupported.rtf`, `samples/6-sample.docx`, `samples/7-sample.pdf`, `README.md`
- Modify: `docs/for-documentation-team.md`

- [ ] **Step 1: Write the text samples**
  1. A short paragraph using at least 6 different terms, including "cleaning lady".
  2. "Chairman", "CHAIRMAN", "chairman", and "He"/"he"/"HE" in sentences.
  3. Neutral text containing "the", "there", "other", "theme", and "shell".
  4. A 0-byte file.
  5. A small valid RTF file containing "he".

- [ ] **Step 2: Generate `6-sample.docx` and `7-sample.pdf`** from the text of sample 1, with any generator scripts kept in the scratchpad, not the repo.
  - **docx:** zip a minimal package (`[Content_Types].xml`, `_rels/.rels`, `word/document.xml` with one `<w:p>` per sentence) using PowerShell `Compress-Archive`, then rename it to .docx.
  - **pdf:** run `msedge --headless --print-to-pdf=<path>` on a small HTML file.

Upload both in the `app` preview. Expected: the same table as sample 1.

- [ ] **Step 3: Run all five guide test cases in the browser** and record the expected result, the actual result, and Pass/Fail in a "Test results" table appended to `docs/for-documentation-team.md`. Take screenshots of: file selection, results with counts, the no-terms result, the empty-file message, the unsupported-format message, and the automaton panel.

- [ ] **Step 4: Write `README.md`.** It covers:
  - what the app does
  - the live link (filled in at Step 6)
  - how to run it locally (`npx serve .`, then open http://localhost:3000)
  - how to run the tests (`node --test tests/`)
  - the project structure
  - the libraries used

- [ ] **Step 5: Run the full test suite**

Run: `node --test tests/`
Expected: all tests pass, 0 fail

- [ ] **Step 6: Publish (outward-facing, so confirm with the user first).** The user creates a **public** GitHub repo, or runs `gh repo create gender-neutral-recognizer --public --source . --push` if `gh` is signed in, then enables **Settings → Pages → Deploy from branch → main / (root)**. Open the Pages URL and upload sample 1. Expected: it gives the same results as locally. Put the URL in the README and in the handoff doc (it goes in document section 3).

- [ ] **Step 7: Commit and push**

```bash
git add samples README.md docs/for-documentation-team.md
git commit -m "docs: samples, README, test results"
git push
```
