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
