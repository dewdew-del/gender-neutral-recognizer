# Gender Neutral Language Recognizer

A static web page that reads a `.txt`, `.docx`, or `.pdf` file and finds 24 predefined gender-specific words and phrases (for example "chairman", "fireman", "he", "cleaning lady") using a hand-built deterministic finite automaton (DFA). It shows a results table (term, occurrences, suggested neutral alternative), a highlighted preview, and an Automaton panel with a live trace and the full transition table. The text is never changed; suggestions are for review only.

**Live link:** _(added after publishing to GitHub Pages)_

## Run locally

```bash
npx serve .
```

Then open the address it prints (usually http://localhost:3000).

## Run the tests

```bash
npm test
```

(This runs `node --test tests/*.test.js`; plain `node --test tests/` does not work on Node 24.)

## Project structure

```
index.html, style.css   the page
js/terms.js             the 24 terms and suggestions
js/fsa.js               DFA build, scan, summary, trace, transition table
js/fileReader.js        file -> text, with validation messages
js/render.js            text + matches -> preview segments
js/app.js               wires the page together
lib/                    vendored mammoth.js and pdf.js (works offline)
samples/                test files for the demo
tests/                  unit tests
docs/                   spec, plan, and notes for the documentation team
```

## Libraries

- [mammoth.js](https://github.com/mwilliamson/mammoth.js) 1.8.0 for `.docx`
- [pdf.js](https://github.com/mozilla/pdf.js) 3.11.174 for `.pdf`
