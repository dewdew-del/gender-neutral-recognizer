# Gender Neutral Language Recognizer — Design Spec

Date: 2026-10-23
Course: Automata and Language Theory (BSCS 3A), instructor Alma Mae B. Auxtero
Deadline: 3 days (2026-10-26)
Roles: one developer (code); group members (project document, screenshots, demo prep)

## 1. Goal

A small web app that opens a text document, finds predefined gender-specific
words and phrases with a hand-built **deterministic finite automaton (DFA)**,
and shows a results table of each term, how many times it occurred, and a
suggested gender-neutral alternative. Suggestions are for review only; the app
does not replace text.

### Why a DFA (not regex)

The folder holds two versions of the requirements. The older one
(`849726060_...png`) requires finite state automata and .txt/.docx/.pdf. The
newer one (`Gender_Neutral_Language_Recognizer_Project_Guide.docx`) allows
regex **or** FSA and makes .docx/.pdf optional. A DFA plus all three formats
satisfies both. It also gives the strongest material for the 25% "use and
explanation of regular expressions or FSA" grade: a state diagram, a
transition table, and a live trace for the demo.

The newer guide is treated as authoritative where the two conflict (for
example, the "no terms" message).

## 2. Requirements checklist (from the newer guide)

| # | Requirement | How it is met |
|---|-------------|---------------|
| R1 | Any language; desktop, web, or CLI | Static web page, HTML/CSS/JavaScript |
| R2 | Regex or FSA recognition | Hand-built DFA in `fsa.js` (no regex used for matching) |
| R3 | Open/upload a .txt file (.docx/.pdf optional) | File picker; .txt, .docx (mammoth.js), .pdf (pdf.js) |
| R4 | At least 10 terms with alternatives | 24 terms in `terms.js` (section 4) |
| R5 | Case-insensitive, whole-word ("he" not in "the") | Input lowercased; DFA starts only at word starts and accepts only before a word end |
| R6 | Results table: term, occurrences, suggestion | Results table in the page |
| R7 | No terms found → "No predefined gender-specific terms were detected." | Exact message shown |
| R8 | Clear message for empty files / unsupported formats | Exact messages in section 6 |
| R9 | Suggestions only, no auto-replace | Table + highlighted preview; text is never modified |
| S1 | Source / public GitHub link | Public GitHub repo, hosted on GitHub Pages |
| S2 | Brief run instructions | `README.md` |
| S3 | One sample .txt file | `samples/` folder (one file per test case) |

## 3. Architecture

Static site, no build step, no server code. Runs from GitHub Pages or any local
static server.

```
gender-neutral-recognizer/
  index.html        page layout; loads libs and scripts in order
  style.css         styling
  js/terms.js       the term list (data only)
  js/fsa.js         DFA build, scan, trace, transition table (no DOM)
  js/fileReader.js  file → text, with validation errors (no FSA)
  js/render.js      pure helper: text + matches → preview segments (no DOM)
  js/app.js         wires the page: picker → reader → fsa → render
  lib/              vendored mammoth.js and pdf.js (works offline at the demo)
  samples/          test-case files
  tests/fsa.test.js Node unit tests for terms.js + fsa.js
  README.md
```

`terms.js`, `fsa.js`, `render.js`, and `fileReader.js` work in both the browser (globals) and Node
(`module.exports`), so the DFA is unit-tested with `node --test`.

### Unit boundaries

- **terms.js** — exports `TERMS`: an array of `{ term, suggestion }`. All
  terms are lowercase. Nothing else.
- **fsa.js** — depends only on a term list.
  - `buildDFA(terms)` → `{ start, delta, accept, states }`.
    `delta[state][symbol] = nextState`; a missing entry is the dead state.
    `accept[state] = termIndex` for accepting states.
  - `scan(dfa, text)` → `[{ termIndex, start, end }]` matches in text order.
  - `summarize(matches, terms)` → `[{ term, suggestion, count }]` in order of
    first occurrence.
  - `trace(dfa, word)` → `{ path: [{ from, symbol, to }], accepted, termIndex }`.
  - `transitionRows(dfa)` → rows `{ state, transitions: [[symbol, next]], accepting, term }`
    for the transition table view.
- **fileReader.js** — `readFile(file)` → `Promise<string>`, or rejects with
  an `Error` whose message is one of the user-facing messages in section 6.
- **app.js** — UI only. Calls the three units above; holds no matching logic.

## 4. Term list (24)

| Term | Suggestion |
|------|-----------|
| chairman | chairperson |
| chairmen | chairpersons |
| policeman | police officer |
| policemen | police officers |
| policewoman | police officer |
| fireman | firefighter |
| firemen | firefighters |
| stewardess | flight attendant |
| mankind | humankind |
| businessman | businessperson |
| salesman | salesperson |
| spokesman | spokesperson |
| mailman | mail carrier |
| manpower | workforce |
| waitress | server |
| cleaning lady | cleaner |
| he | they |
| she | they |
| him | them |
| her | them / their |
| his | their / theirs |
| hers | theirs |
| himself | themself |
| herself | themself |

"cleaning lady" demonstrates that the automaton recognizes phrases, not only
single words.

## 5. The automaton

### Alphabet

Σ = { a–z, space }. Before a character is fed to the DFA it is lowercased.
Any whitespace character (space, tab, newline) maps to the space symbol. Any
other character has no transition, so it leads to the dead state.

### Construction

The DFA is a trie over the term list.

- q0 is the start state.
- For each term, walk from q0 one symbol at a time, creating a new state when
  a transition does not exist yet.
- The state reached after the last symbol becomes accepting and remembers
  which term it accepts.
- Every state entered on the space symbol gets a self-loop on space, so a
  phrase still matches when its words are separated by several spaces, a tab,
  or a line break (including Windows `\r\n`).
- Every undefined transition goes to an implicit dead state q∅ (not stored).

Shared prefixes share states. For example, "he", "her", "hers", and "herself"
lie on one path, and "him", "himself", and "his" branch off after "h".

### Scanning (whole-word, case-insensitive)

A word character is a Unicode letter or digit (`/[\p{L}\p{N}]/u`).
Everything else is a boundary, including apostrophes, hyphens, punctuation,
and whitespace.

```
i = 0
while i < text.length:
    if i is a word start (i == 0 or text[i-1] is not a word char):
        state = q0; best = none; j = i
        while j < text.length and delta[state][sym(text[j])] exists:
            state = delta[state][sym(text[j])]; j++
            if state is accepting and (j == text.length or text[j] is not a word char):
                best = (accept[state], i, j)
        if best: record best; i = best.end; continue
    i++
```

- **Case-insensitive:** `sym()` lowercases each character.
- **Whole word, left side:** the DFA only starts at a word start, so the "he"
  inside "the" is never tried.
- **Whole word, right side:** acceptance only counts when the next character
  is a boundary. "he" in "hello" does not count.
- **Longest match:** the loop keeps going after an accept and keeps the
  longest. "herself" wins over "her" and "he".
- After a match, scanning resumes at the match end.

Example traces:
- "Fireman," → q0 →f →i →r →e →m →a →n → accept (fireman); "," is a boundary.
- "the" → position 0 is a word start, but there is no "t" transition from q0
  (dead). Positions 1 and 2 are not word starts. No match.

### Known limitations (for the Conclusion section)

- There is no context awareness: "her" is always flagged, and the suggestion
  has to be reviewed by a person.
- Scanned PDFs (images) have no extractable text.
- Legacy .doc (Word 97–2003) files are not supported.

## 6. File handling and messages

| Situation | Behavior / exact message |
|-----------|--------------------------|
| Extension not .txt/.docx/.pdf (case-insensitive) | "Unsupported file format. Please upload a .txt, .docx, or .pdf file." |
| File is 0 bytes, or extracted text is only whitespace | "The file is empty. Please upload a file that contains text." |
| .docx or .pdf fails to parse | "The file could not be read. It may be damaged or password-protected." |
| Readable text, no matches | "No predefined gender-specific terms were detected." |
| Readable text, matches | Results table + highlighted preview |

The reader is chosen by file extension:

- .txt: `file.text()`
- .docx: `mammoth.extractRawText({ arrayBuffer })`
- .pdf: pdf.js `getDocument` → each page's `getTextContent()`, items joined
  with spaces, pages joined with newlines

## 7. User interface (one page)

1. **Header** with the title and a one-line description.
2. **File picker** that accepts .txt, .docx, and .pdf. Selecting a file runs
   the analysis right away. The selected file name is shown.
3. **Message area** for the messages in section 6, styled as info or error.
4. **Results table** with the columns # / Gender-specific term / Occurrences /
   Suggested alternative, and a total row.
5. **Document preview** showing the extracted text with matched terms
   highlighted. Hovering a highlight shows its suggestion.
6. **Automaton panel** (collapsible):
   - a summary: the number of states, the number of accepting states, and the
     alphabet
   - a **trace box**: type a word or phrase to see its state path and whether
     it is accepted
   - the **transition table**: one row per state, listing its outgoing
     transitions, with accepting states marked and their term shown

The automaton panel is the material for the demo and for document section 2
screenshots.

## 8. Testing

**Unit tests** (`node --test tests/`):
- every term in `TERMS` is matched on its own
- "the", "there", and "other" produce no match for "he"
- "hello" and "shell" produce no match
- "CHAIRMAN Chairman chairman" → chairman count 3
- "herself" → one match for herself (not her or he)
- "fireman," and "(she)" match through punctuation
- "he's" matches "he"
- "cleaning lady" matches; so do "cleaning  lady" and "cleaning\r\nlady";
  "cleaning" alone does not
- empty string → no matches
- `trace` returns the expected path for "fireman" and rejects "the"

**Manual test files** (`samples/`), one for each of the guide's five cases:
1. `1-with-terms.txt`: several different listed terms
2. `2-repeated-mixed-case.txt`: the same term repeated in different cases
3. `3-no-terms.txt`: neutral text containing "the", "there", and "other"
4. `4-empty.txt`: a 0-byte file
5. `5-unsupported.rtf`: an unsupported format

There are also `6-sample.docx` and `7-sample.pdf` to show the optional formats.

## 9. Delivery

- Public GitHub repo, published with GitHub Pages. The link goes into
  document section 3.
- `README.md` explains how to open the GitHub Pages link or serve locally
  (`npx serve .`), and how to run the tests.
- Hand-off to the documentation team: the term table (section 4), the
  automaton explanation (section 5), the test cases (section 8), and the known
  limitations.

## 10. Out of scope

Automatic replacement, editing text in the app, legacy .doc, OCR, saving or
exporting reports, user-defined term lists, and any backend.
