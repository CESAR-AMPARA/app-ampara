# Feature Specs

This directory contains the specs for features that **haven't been built yet**.

A spec describes what to build, why to build it, what it implicates on our system and our dependencies; once the feature ships and the tests prove it, the spec is deleted — **the tests become the permanent record of the behaviour**, and [`../adr/`](../adr/README.md) keeps the decisions worth remembering.

## Naming

`NNNN-kebab-case-title.md`, zero-padded and sequential — the same convention as `adr/`. The two sequences are independent: `todo/0003-…` has nothing to do with `adr/0003-…`.

The next number lives in [`NEXT_SPEC`](NEXT_SPEC), a file whose entire content is that number. Numbers are never reused, and a shipped spec is deleted, so the files on disk don't tell you where the sequence is — the highest number here is not the last one taken. `NEXT_SPEC` is the record: bump it in the same commit that adds the spec.

It sits outside this README so that two branches claiming numbers at once collide on one line of one file that holds nothing else, and the merge is resolved by taking the higher number. The merge itself never bumps — it only picks a number that was already claimed — with one exception: if both branches added a spec starting from the same number, two files on disk now carry it, and resolving that means renumbering one of them to the value in `NEXT_SPEC` and bumping `NEXT_SPEC` once more.

Important: **There is no spec index.** The directory listing is the index: `ls todo/` names every spec still open, and the kebab-case title in each filename says what it is. A list maintained here would be a second place to forget, and a stale index is worse than none.

## One spec, one side

**A spec is never fullstack.** It covers the backend or the frontend, never both. **Backend and frontend are implemented by different developers**, and a spec is the unit of work handed to one of them — a document whose reader has to skip half of it is a document that gets skimmed, and the half that matters gets skimmed with it.

A feature that moves both sides is therefore **two specs**, written together and numbered consecutively:

- Each states its own problem in its own terms, and stands on its own. Neither says "see the other spec for what this is for."
- Each opens with a one-line note naming its counterpart and saying whether it ships independently.
- The shared contract — the NDJSON frame, the request schema — is specified in full in the **backend** spec. The frontend spec consumes it and links back rather than restating it, so there is exactly one place for it to be wrong.
- Each lists the other's work under _Out of Scope_, by link.

Written this way, either side can start immediately: the contract is pinned before either developer opens an editor, and the frontend can be built and tested against it before the backend ships.

## Writing

These rules govern the text of a spec. They don't govern chat, commit messages, or code comments. Where they and the sample spec below disagree, the rules win and the sample gets fixed.

### Language

**Specs are written in English, always** — headings, prose, and the terms you coin for the feature. The code and its docstrings are in English; a spec that switches languages forces every reader to translate the seam names back before they can grep for them. The one exception is text that ships in Portuguese, which is quoted verbatim rather than translated: UI copy from `content/pt-BR.ts`, exactly as the user will read it, and model-facing text — the system prompt, and the name and description of a tool the model chooses from — exactly as the model will read it. See the `LANGUAGE` section of [`../backend/DEV_WORKFLOW.md`](../backend/DEV_WORKFLOW.md) for which is which.

### Voice

Prose of a senior engineer writing for the peer who will implement this. Direct, confident, unpadded. Assume full technical competence in the reader and no project context: they may never have opened the modules you name.

Active voice by default. Passive only when the actor is irrelevant or unknown.

"We" when the decision belongs to the team. First person when the call is yours and someone could reasonably contest it. Never "it is believed that" or "it was decided that" — a decision with no author is a decision no one can argue with.

### Structure

The first sentence of a section states its conclusion; the rest justifies it. A reader who stops after the first sentence of every section should still leave with the whole argument. This matters most in _Implementation Decisions_, where the reason for a choice, not the choice, is the payload.

Paragraphs of 3 to 7 lines. One paragraph, one idea.

### Lists and prose

Use a list when the items are parallel, enumerable, and argue nothing against each other: user stories, test modules, the no-s under _Out of Scope_. Use prose when there is cause, contrast, condition, or a chain of reasoning — which is what bullets destroy, and which is most of _Implementation Decisions_.

Never nest more than two levels. Never write a one-sentence bullet that belonged in the paragraph above it.

### Banned vocabulary

Filler: "it's important to note", "it's worth mentioning", "needless to say", "at the end of the day", "in today's landscape", "last but not least".

Corporate vague: "holistic", "synergy", "leverage" as a verb, "seamless", "disruptive", "cutting-edge", "state of the art" without saying what it beats, "robust" and "scalable" without a number, "best practice" without saying whose.

Constructions: "not only… but also", "dive into", "delve", "unlock the potential", "transform the way".

If a sentence needs "it's important to note" to carry weight, the sentence is weak. Rewrite it.

### Precision

Every quantitative claim carries a number, a unit, and where it came from. "Faster" → "first frame in roughly 200 ms instead of 4 s, measured against the dev gateway".

Every risk carries an impact and a mitigation. A risk with neither is a complaint, not analysis.

Mark uncertainty in the text where it exists: "unverified against the production gateway", "assumes `litellm` keeps normalizing this field". _Further Notes_ is for the uncertainty that outlives a parenthesis.

Name modules, never line numbers. Quote a contract fragment — a frame, a TypedDict, a schema field — verbatim in a fenced block instead of describing it in prose.

### Terms

Expand an acronym on first use — e.g.: "Architecture Decision Record (ADR)" — then use the short form only. Pick one name per concept and hold it for the whole document: the `thinking` frame or the reasoning frame, not both.

### Formatting

`#` only in the title, on the first line of the file. `##` and `###` for the body; no `####`.

No line breaks inside a paragraph: each paragraph, and each list item, is a single logical line however long it runs. Real newlines exist only between paragraphs and sections, and inside fenced blocks, where the original breaks are preserved. Never break a sentence to fit a column width — the reader wraps text, and hard wrapping only makes every later edit reflow lines that didn't change.

Bold sparingly, for the key term of a paragraph at most, never a whole sentence. Italics for the pairing note under the title, for a section name quoted as a name (_Out of Scope_), and for the occasional load-bearing contrast — never decoration. No emoji, no HTML. Em-dash asides sparingly — one per paragraph is already a lot. A table only when comparing three or more items across two or more dimensions. Mermaid for flow, architecture, and sequence — don't restate in prose what the diagram already shows; annotate what it doesn't.

Backtick every identifier: modules, fields, frame types, test files. Link a sibling spec or an ADR the first time it comes up, not every time.

### Numbers and dates

Decimal point, comma thousands separator: 1,234.56. Percent closed up: 40%. Units spaced: 200 ms, 8 kB. Ranges with "to": "3 to 5 days", not "3-5 days". Dates as 2026-08-12, in the body and in filenames alike. Currency symbol always: R$ or US$.

## Spec Template

```markdown
# {Feature title}

## Problem
{The user-facing problem, in the user's words. What can't they do today, and why does that hurt? No solution here.}

## Business Vision and Purposes
{The business need for this feature and enabled action/decision for the user after feature implementation.}

## Solution
{The user-facing behaviour once this is built. Still no code.}

## User Stories
1. As a {actor}, I want {capability}, so that {benefit}.
2. ...

## Implementation Decisions
{The modules and seams that change, contract changes (NDJSON frames, request and response schemas), and the choices a reader would otherwise second-guess. Name modules, never line numbers — a spec that inventories code is obsolete the day after it's written.}

## Testing Decisions
{Which seams get exercised and with what doubles. Prefer an existing seam over a new one, and name the test modules that will be created or extended.}

## Out of Scope
{The explicit no-s. As valuable as the yes-s.}

## Further Notes
{Optional. Anything that doesn't fit above.}
```

A section with nothing to say gets deleted, not filled with "N/A". A two-paragraph spec is a fine spec. The value is in stating the problem and pinning down the seams — not in filling out headings.

To name test modules correctly in _Testing Decisions_, follow the conventions already in place: backend paths are flattened into the filename, per [`../backend/DEV_WORKFLOW.md`](../backend/DEV_WORKFLOW.md), while frontend tests mirror the source path.

## When a spec earns its own file

Write one when at least one of these is true:

- **It spans modules** — several modules on one side move together. If both sides move, that's two specs, one per side.
- **It changes a contract** — an NDJSON frame, a request/response schema, a protocol, etc.
- **There's a real ambiguity** — a question someone has to answer before any code is worth writing.

A one-line fix, a copy tweak, a rename: just do it. Writing the spec would take longer than the change.

## Where decisions belong

A spec is temporary and forward-looking — it says what to build now, and it goes away when the feature lands. An ADR is standing and backward-looking — it says why the code is the way it is, and it stays, kept current, as long as the decision holds.

If, while building, you make a choice that is hard to reverse, surprising without context, and the result of a genuine trade-off, that choice graduates into an ADR — see the gate in [`../adr/README.md`](../adr/README.md). The ADR outlives the spec.

## Sample Spec

A example of a complete spec, written against the real modules of this repo, but with a fictional user need.

```markdown

```
