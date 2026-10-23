# For the documentation team

Material for **document section 2** (design / approach). The live link for section 3 is added once the app is published.

## Language and tools

- HTML, CSS, and JavaScript (no framework, no build step), runs in any browser.
- mammoth.js 1.8.0 reads `.docx`; pdf.js 3.11.174 reads `.pdf`. `.txt` is read by the browser.
- Node.js `node:test` is used only for unit tests.

## Approach: a hand-built DFA

The recognizer is a deterministic finite automaton (DFA) built in `js/fsa.js`; no regular expression is used to match terms. We chose a finite state automaton because the older requirement sheet requires FSA, and it gives a state diagram, a transition table, and a live trace to show.

## The 24 terms

| # | Term | Suggested alternative |
|---|------|----------------------|
| 1 | chairman | chairperson |
| 2 | chairmen | chairpersons |
| 3 | policeman | police officer |
| 4 | policemen | police officers |
| 5 | policewoman | police officer |
| 6 | fireman | firefighter |
| 7 | firemen | firefighters |
| 8 | stewardess | flight attendant |
| 9 | mankind | humankind |
| 10 | businessman | businessperson |
| 11 | salesman | salesperson |
| 12 | spokesman | spokesperson |
| 13 | mailman | mail carrier |
| 14 | manpower | workforce |
| 15 | waitress | server |
| 16 | cleaning lady | cleaner |
| 17 | he | they |
| 18 | she | they |
| 19 | him | them |
| 20 | her | them / their |
| 21 | his | their / theirs |
| 22 | hers | theirs |
| 23 | himself | themself |
| 24 | herself | themself |

"cleaning lady" shows that the automaton recognizes phrases, not only single words.

## The automaton

- **Alphabet** Σ = { a–z, space }. Every character is lowercased first (so matching is case-insensitive). Any whitespace (space, tab, line break) becomes the space symbol. Any other character has no transition.
- **Construction.** The DFA is a trie over the term list. q0 is the start state. For each term we walk from q0 one symbol at a time and create a new state whenever the transition does not exist yet. The state after the last symbol is accepting and remembers its term. Terms with a common prefix share states (e.g. `he`, `her`, `hers`, `herself` lie on one path; `him`, `himself`, `his` branch off after `h`).
- **Dead state.** Every missing transition goes to an implicit dead state q∅ (not drawn). Once there, the input cannot be accepted.
- **Space self-loop.** Every state entered on the space symbol loops to itself on space, so "cleaning  lady" (two spaces), a tab, or a Windows line break between the words still matches.
- **Whole word.** A word character is a Unicode letter or digit; everything else (punctuation, apostrophes, hyphens, spaces) is a boundary. The DFA only starts at a word start, and a match only counts if the next character is a boundary. So `he` is not found in "the", "there", or "hello", but is found in "he's" and "(he)".
- **Longest match.** After reaching an accepting state the scan keeps going and keeps the longest accept: "herself" is one match, not "her" or "he".
- **Total states:** **125** (including q0 and the 24 accepting states; the dead state is not counted).

## Actual traces (printed from `FSA.trace`)

`fireman` — **accepted** (term: fireman → firefighter), 7 steps:

```
q0 -f-> q27 | q27 -i-> q28 | q28 -r-> q29 | q29 -e-> q30 | q30 -m-> q31 | q31 -a-> q32 | q32 -n-> q33
```

`the` — **rejected**, dead state at the first symbol:

```
q0 -t-> dead
```

## Please draw by hand for the document

1. The state diagram for **fireman** (q0 → … → accepting state, with the dead state).
2. The state diagram for **he / her / hers / herself** (a shared path with four accepting states).

The full transition table is in the app: open **Automaton** → *Transition table*.

## Known limitations (Conclusion section)

- No context awareness: "her" is always flagged, and the suggestion needs a person's review. The app never changes the text.
- Scanned PDFs (images) have no extractable text.
- Legacy `.doc` (Word 97–2003) files are not supported.
