---
title: Section brief — <chapter>.<section> <title>
doc_type: section-brief
chapter: <N>
section: <N>.<M>
writer: <cc-writer | codex-writer>
status: drafting
tags: [workflow, brief, chapter-<N>]
---

# Section brief — <N>.<M> <title>

> Phase 4 deliverable per section. Main session builds; the brief is the writer's only input. If any field below is missing, the writer refuses with a single-line explanation naming the missing field.

## Path constraint (HARD)

Writer is allowed to write to **exactly one path**:

```
chapter_<N>_<slug>/<N>_<M>_<section_slug>.md
```

Any other write is blocked by the PreToolUse hook (cc-writer) or discarded as out-of-scope (codex-writer).

## Book context (one paragraph)

<From `_workflow/plans/book_outline.md` §1 topic statement, plus any cross-cutting threads (§3) this section touches.>

## Chapter context (one paragraph)

<From the chapter plan: how this section fits in the chapter, what it is the entry / middle / closing of.>

## Section scope

- **In:** <bulleted list of what this section covers>
- **Out:** <bulleted list of what is explicitly NOT this section's job; reference where each lives>
- **Depth:** <intro / applied / theory / synthesis>
- **Length band:** <e.g. "200–400 lines" — exclusive of frontmatter>

## Research synthesis excerpt

<Slice of `_workflow/research/<N>_<chapter_slug>_synthesis.md` that is this section's evidence base. Concrete claims, citations, dates, names. Writer must not invent beyond this.>

## Handoff snippet (only if section is dependent)

<2–4 sentences naming what predecessor section(s) establish: terminology to match, assumptions to inherit, what to avoid re-deriving.>

## Cross-section artifact contracts (only if this section produces or consumes structured rows / tables / catalogs another section depends on)

If the chapter plan §12 names this section as a producer or consumer of a cross-section artifact, restate the artifact contract here verbatim **as it currently appears in the chapter plan**, including any `(normalized YYYY-MM-DD via <commit-sha>)` annotations from previous batches' producer artifact acceptance checkpoints. The writer is bound to this exact shape.

§12 in the chapter plan is the single source of truth. Never derive contract shape from "as-built" producer files; always restate what §12 currently says.

Skip the section if the chapter plan does not list any cross-section artifacts touching this section.

## Style anchor

- **Anchor file:** `<path>.md`
- **Voice rules:**
  - <bullet>
  - <bullet>

## Framing constraints

- **Explanation order (or narrative shape):** <e.g. "concept → mechanism → worked example → contrast">
- **Depth budget:** <e.g. "treat the algebra as background; do not re-derive">
- **Allowed analogy registers (or POV / tense for narrative):** <e.g. "physics analogies OK; biology analogies avoid; no pop-culture references">

## Terminology contract

| Term | Spelling / casing / one-line gloss |
|---|---|
| <term 1> | <exact form> |
| <term 2> | <exact form> |

> All terms above are bound by the chapter plan's must-preserve list. Do not paraphrase.

## Format requirements

- Plain Markdown (or specify Obsidian Flavored Markdown if the project uses it).
- Frontmatter: `workflow_status: draft` is mandatory; other fields per `_templates/_section.md`.
- Callouts: <list which `> [!type]` callouts are allowed in this section, or "none">.
- Cross-references: <e.g. "use plain Markdown links `[link](path.md)` for cross-section refs">.

## Contingency adjudication (only if STATE.md `do_not_redo` carries a `[contingency-pending-readjudication]` marker for this section)

For each pending `main-direct: writer-unavailable-contingency` previously applied to this section, list:

- Commit SHA of the contingency
- Cause (one line: e.g. "codex-companion 429 rate-limit")
- `before:` quoted single line
- `after:` quoted single line

Writer must decide per item: **accept-as-is** (keep the contingency wording), **revise** (provide new wording in place), or **reject** (revert to the `before:` line, with rationale). Resolution is reported in the manifest. Once the writer's resolution is committed, main session clears the marker from STATE.md `do_not_redo`.

Skip this section if no pending contingency exists.

## Manifest expectations (return to dispatcher)

- Path written
- Approximate line count
- Open questions for the per-section deal-loop
- Per-item resolution for any Contingency adjudication entries (accept-as-is / revise / reject + one-line rationale on reject)
- One-line declaration: "Wrote ONLY to <path>"
