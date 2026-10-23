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
js/assistant.js         Groq question helper (prompt + API call)
js/app.js               wires the page together
lib/                    vendored mammoth.js and pdf.js (works offline)
samples/                test files for the demo
tests/                  unit tests
docs/                   spec, plan, and notes for the documentation team
```

## Libraries

- [mammoth.js](https://github.com/mwilliamson/mammoth.js) 1.8.0 for `.docx`
- [pdf.js](https://github.com/mozilla/pdf.js) 3.11.174 for `.pdf`

## Question helper (Groq)

The "Ask a question" window answers questions about the project using the Groq API. Each user pastes their own free key from https://console.groq.com/keys. The key is kept only in that browser's localStorage and is sent only to Groq; it is never stored in this repository. Do not hard-code a key in the source.

### Shared helper for everyone (Vercel)

`api/ask.js` is a serverless function that holds the Groq key so visitors do not need their own. Deploy the whole folder to Vercel and add an environment variable named `GROQ_API_KEY` in the project settings (never commit it). The page calls `/api/ask` first and falls back to a visitor's own key if the function is not there (for example on localhost or GitHub Pages).
