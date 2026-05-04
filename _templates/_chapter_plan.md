---
title: Chapter <N> plan — <Chapter title>
doc_type: chapter-plan
chapter: <N>
status: drafting
tags: [workflow, plan, chapter-<N>]
---

# Chapter <N> plan — <Chapter title>

> Phase 3 plan brief. Items 1–11 are the recommended structure (see `_workflow/pipeline_design.md` §3 Phase 3). Merge / split / skip items based on chapter character; codex-collaborator CONFLICT must explicitly ratify any item omitted.

## 1. Section list

| # | Slug | Scope-in | Scope-out | Depth | Length band |
|---|---|---|---|---|---|
| <N>.1 | <slug> | <one-line> | <one-line> | <intro / applied / theory / synthesis> | <line band, e.g. 200–400> |
| <N>.2 | <slug> | <one-line> | <one-line> | <depth> | <band> |

## 2. Section dependency DAG

```
<N>.1 ─┐
       ├──> <N>.4
<N>.2 ─┘

<N>.3 ──> <N>.5

<N>.6 (independent)
```

## 3. Parallel batch groups

- **Batch 1** (independent leaves): <N>.1, <N>.2, <N>.3, <N>.6
- **Batch 2** (depends on Batch 1): <N>.4, <N>.5
- **Batch 3** (depends on Batch 2): <N>.7

## 4. Writer assignments

| Section | Writer | Rationale (Rule 3a classification — codex-default; cc reserved for contested-framing / high-judgment-synthesis / novel-integration) |
|---|---|---|
| <N>.1 | codex-writer | default |
| <N>.2 | codex-writer | default |
| <N>.3 | cc-writer | high-judgment synthesis — integrates contested framings from §<X> and §<Y> |
| ... | ... | ... |

> **Locked at Phase-3 AGREED.** No mid-run fallback per Rule 3a.

## 5. Handoff snippets

For each dependent section, 2–4 sentences naming what its predecessor will establish.

**<N>.4 (depends on <N>.1, <N>.2):**
> <2–4 sentences: terminology to inherit, assumptions to carry forward, what to avoid re-deriving.>

**<N>.5 (depends on <N>.3):**
> <2–4 sentences.>

## 6. Style anchor reference

- **Anchor file:** `<path-to-canonical-completed-section>.md`
- **Voice rules:**
  - <e.g. "second-person framing in worked examples">
  - <e.g. "fenced equations, not inline LaTeX">
  - <e.g. "explanation before formal definition">

## 7. Prerequisite chain

- From chapter <X>: <terminology / concept the chapter inherits, with section-level citation>
- From chapter <Y>: <terminology / concept>

## 8. TOC slice

The relevant ±2 chapters of the book outline, so codex sees this chapter in context.

| # | Chapter | One-line scope |
|---|---|---|
| <N-2> | <title> | <scope> |
| <N-1> | <title> | <scope> |
| **<N>** | **<this chapter>** | **<scope>** |
| <N+1> | <title> | <scope> |
| <N+2> | <title> | <scope> |

## 9. Must-preserve terminology list

| Term | Spelling / casing / definition |
|---|---|
| <term 1> | <exact form, optional one-line gloss> |
| <term 2> | <exact form, optional gloss> |

## 10. Reader knowledge assumptions at chapter entry

<One paragraph: what a reader who has finished chapters 1..N-1 is expected to know.>

## 11. Downstream commitments

<What chapters after this one will assume from this chapter — informs section depth and what must be made explicit vs left implicit.>

## 12. Cross-section artifact contracts (optional)

For chapters where one section consumes structured output produced by another (e.g. a synthesis section aggregating per-section catalog rows; a comparison table assembled from sibling sections), name each artifact explicitly so producers and consumers can be checked against the same schema.

| Artifact | Producer section(s) | Consumer section(s) | Required schema / fields | Validation rule |
|---|---|---|---|---|
| `<artifact_id>` | <N>.<a> | <N>.<b> | `field1: <type>`, `field2: <type>`, ... | <e.g. "consumer must list all producer rows verbatim; missing rows fail Phase-5 final review"> |

Skip this section entirely if no cross-section artifacts exist. When present, the consumer section's brief must restate the schema and producer list verbatim.

**DAG rule (Phase-3 deal-loop enforces).** For every artifact, the producer section's batch number (per §3) must be **strictly less than** every consumer section's batch number. Same-batch producer→consumer is invalid: a consumer cannot read an artifact being drafted concurrently. Codex-collaborator rejects §12 rows that violate this.

**Source-of-truth + normalization rule (Phase-5 acceptance checkpoint enforces).** §12 is the single contract. After a producer section closes Phase-5 AGREED, main session runs the producer artifact acceptance checkpoint (`section-deal-loop` skill):

- If the produced artifact matches the row above exactly → main session **annotates the row in place** with `(producer <N>.<m>: accepted YYYY-MM-DD via <agreed-sha>)`. `<agreed-sha>` is the producer section's `agreed(...)` commit SHA (never the in-flight lockstep SHA). Per-producer when the row has multiple producers — one annotation clause per producer, appended as each one closes. The annotation set is what `draft-batch`'s dispatch-time §12 invariant check reads to confirm every producer was accepted.
- If it drifted *within* the row's allowed shape (a name choice, an ordering convention, an optional field added or omitted) → main session **amends the row in place** and adds an inline annotation `(producer <N>.<m>: normalized YYYY-MM-DD via <agreed-sha>)`. Per-producer for multi-producer rows. Consumer briefs drafted afterward consume the amended row.
- If it violates the row (required field missing / schema broken / drift changes consumer obligation) → main session reopens the producer's Phase-5 deal-loop. Do NOT amend §12.

Consumer briefs ALWAYS read the current §12; they never derive contract shape from "as-built" producer files.

**Scope-discovery rule.** If a producer is observed to emit a structured artifact §12 did not anticipate, treat it as a Phase-3 plan defect: pause downstream brief drafting, run a tightly-scoped Phase-3 plan deal-loop on §12 with codex-collaborator MODE: CONFLICT, commit as `lockstep(<chapter>): §12 scope discovery — <artifact-id> — <one-line>`, then run the acceptance checkpoint. Do NOT amend §12 ad hoc.
