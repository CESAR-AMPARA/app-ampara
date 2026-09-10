# Architecture Decision Records (ADRs)

This directory contains the project's **Architecture Decision** Records (ADRs).
Each file records an important **technical choice, the context, the decisions (including alternatives not followed), and their consequences**.

## ADR Template
```markdown
# {Short title of the decision}

{1-3 sentences: what's the context, what did we decide, and why.}
```
That's it. An ADR can be a single paragraph. The value is in **recording that a decision was made and why** — not in filling out sections.

### Optional sections
Only include these when they add genuine value. Most ADRs won't need them.

- **Considered Options** — only when the rejected alternatives are worth remembering
- **Consequences** — only when non-obvious downstream effects need to be called out.

### When to offer an ADR

All three of these must be true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful
2. **Surprising without context** — a future reader will look at the code and wonder "why on earth did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons

If a decision is easy to reverse, skip it — you'll just reverse it. If it's not surprising, nobody will wonder why. If there was no real alternative, there's nothing to record beyond "we did the obvious thing."

### What qualifies

> With examples.

- **Architectural shape.** "We're using a monorepo." "The write model is event-sourced, the read model is projected into Postgres."
- **Integration patterns between contexts.** "Ordering and Billing communicate via domain events, not synchronous HTTP."
- **Technology choices that carry lock-in.** Database, message bus, auth provider, deployment target. Not every library — just the ones that would take a quarter to swap out.
- **Boundary and scope decisions.** "Customer data is owned by the Customer context; other contexts reference it by ID only." The explicit no-s are as valuable as the yes-s.
- **Deliberate deviations from the obvious path.** "We're using manual SQL instead of an ORM because X." Anything where a reasonable reader would assume the opposite. These stop the next engineer from "fixing" something that was deliberate.
- **Constraints not visible in the code.** "We can't use AWS because of compliance requirements." "Response times must be under 200ms because of the partner API contract."
- **Rejected alternatives when the rejection is non-obvious.** If you considered GraphQL and picked REST for subtle reasons, record it — otherwise someone will suggest GraphQL again in six months.

## How to write one

An ADR is read by someone who found it while confused. They are looking at a line of code that makes no sense, they grepped, they landed here, and they have one question: why is it like this? Everything below serves answering that in the first two sentences.

### Language

**ADRs are written in English, always.** The code, the docstrings and the decisions all live in the same language, so a reader who greps a type name in an ADR finds the same word in the source.

### The title is the decision

The title states what was decided, not what the decision was about: "Gemini Flash as an abstraction over the Gemini gateway", not "Gateway choice" and not "How we call the model". A reader scanning the index should be able to reconstruct the architecture from titles alone, without opening a file. No `ADR-0002:` prefix — the filename already carries the number.

### First sentence, whole decision

Open with the rule as it holds today, in the present tense: "Domain services don't depend directly on third-party SDKs." Then the reason. Then what it costs. An ADR is not a narrative of how the team got there — nobody needs the meeting. If the reasoning takes a second paragraph, the second paragraph starts with the part the reader would otherwise get wrong.

Present tense for what holds now, past tense only for what was rejected. **"We chose X" is right where the choice is contestable; "it was decided" is never right, because a decision with no author is a decision no one can be asked about.**

### Name the cost

Every ADR says what the decision costs, in the same breath as the benefit — the ADC setup in `0003`, the buffering constraint in `0004`. A record whose consequences are all upside is advertising, and the next engineer will discover the downside on their own and trust the directory less for it.

Cost belongs in the prose. _Consequences_ is for the downstream effect a reader wouldn't derive from the decision itself, like a rule about route registration order.

### Length and level

One to three sentences is a complete ADR. The value is in the fact that a choice was made and why, so anything that isn't the decision, its reason, or its price is padding.

Write at the level of shape, not implementation. Name modules and protocols; never line numbers, never a file inventory, never a code walkthrough — the code moves and the ADR must survive it. Quote an identifier when the reader will grep for it, and stop there.

### It is a document, and it shows only the current decision

This directory describes the code as it stands today, so every ADR states the decision in force — not the one that was in force when the file was created. A decision that changes is edited in place until the first sentence is true again; a decision that stops applying takes its file with it.

No status headers, no "superseded by" chains, no history section at the bottom. Git carries the history, and a reader who has to diff two ADRs to work out which rule is live has been handed our filing problem instead of an answer. Keep a rejected alternative only while the rejection still stops someone from re-proposing it, and keep it under _Considered Options_ where it belongs.

Numbers are not recycled: a deleted ADR leaves its number retired, so an old commit message or code comment that cites `0004` never points at something else.

### Vocabulary to avoid

Non-reasons: "best practice", "industry standard", "the modern approach", "cleaner", "more elegant", "future-proof", "for scalability" with no number attached. Each one names an authority instead of a reason, and authority is exactly what the confused reader can't check.

Hedges: "we may want to", "for now", "eventually we should", "TODO". An ADR records a decision that was taken; work that hasn't been decided yet doesn't belong here.

Non-authorship: "it was decided", "it is believed", "it is generally accepted".

### Formatting

No line breaks inside a paragraph: each paragraph, and each list item, is a single logical line however long it runs. Real newlines exist only between paragraphs and sections, and inside fenced blocks. Nothing here is hard-wrapped to a column — the reader's editor wraps text, and wrapping by hand makes every later edit churn lines that didn't change.

`#` only in the title, on the first line. `##` for an optional section, and nothing deeper: an ADR that needs `###` is either two ADRs or a document pretending to be one. Backtick every identifier — module, protocol, header, field. Expand an acronym on first use, then use the short form. Numbers carry a unit and an origin ("under 200 ms, from the partner API contract"). Dates as 2026-08-12. No emoji, no HTML, no decorative bold. A Mermaid diagram only when the decision is a shape that prose genuinely can't hold.

## Decision Index

- 