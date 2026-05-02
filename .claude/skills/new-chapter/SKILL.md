---
name: new-chapter
description: Phases 1–3 for one chapter — parallel research, research deal-loop, then chapter plan + allocation deal-loop. Use when starting a fresh chapter (no `_workflow/plans/<chapter_slug>_chapter_plan.md` yet) or when the user says "start chapter N" / "plan chapter N". Ends when the chapter plan reaches AGREED — section drafting is the separate `draft-batch` skill (Phase 4).
---

# new-chapter — Phases 1–3 for one chapter

Verbose spec: `_workflow/pipeline_design.md` Phases 1–3.

## Preconditions

- `_workflow/plans/book_outline.md` exists and was approved (`outline:` commit in history).
- The target chapter has an overview shell at `chapter_<N>_<slug>/<N>_0_overview.md` with `workflow_status: planned`.
- No chapter plan exists yet at `_workflow/plans/<chapter_slug>_chapter_plan.md` (or user explicitly wants to redo).

## Steps

### Phase 1 — Parallel research

Dispatch three streams in **a single message with three parallel `Agent` tool calls**:

- Main session: read the chapter overview, the book outline, and any prior chapters' completed sections that this chapter inherits from. Draft your own findings.
- `gemini-researcher`: dispatch with the chapter scope + a one-paragraph context (book topic, this chapter's role, prior chapters' coverage).
- `codex-collaborator MODE: RESEARCH`: same scope and context.

Wait for both subagents to return.

### Integrate the three streams

Write `_workflow/research/<chapter_slug>_synthesis.md` containing:

- **Findings** — merged and deduplicated, with attribution where streams diverge.
- **Sources** — combined source list.
- **Open questions** — collected from all three.
- **Coverage note** — which findings the main session believes belong in this chapter vs adjacent chapters.

### Phase 2 — Research deal-loop

Dispatch `codex-collaborator MODE: CONFLICT, ROUND: 1` with the synthesis + your reasoning (what to keep / cut, where coverage is thin, what should escalate to a structural proposal).

Iterate per the convergence protocol. **Watch for structural proposals from codex** (new section, scope shift, reorder, additions beyond the book outline). These are *proposed-not-adopted*: AGREEd structural changes require explicit user approval, then a lockstep update to `_workflow/plans/book_outline.md` + `00_table_of_contents.md` + affected chapter overviews before drafting begins.

On AGREED (with no structural proposals, or with them deferred for user approval):

```bash
git add _workflow/research/<chapter_slug>_synthesis.md
git commit -m "plan(<N>): research synthesis agreed"
```

### Phase 3 — Chapter plan + allocation

Draft `_workflow/plans/<chapter_slug>_chapter_plan.md` using `_templates/_chapter_plan.md`. Cover at minimum the 11 recommended items (merge / split / skip with explicit codex ratification per pipeline_design.md §3 Phase 3):

1. Section list (slugs, scope-in/out, depth, length band)
2. Section dependency DAG
3. Parallel batch groups
4. Writer assignments (codex-default per Rule 3a; cc-writer for chapter-classified contested-framing / high-judgment-synthesis / novel-integration sections, with rationale)
5. Handoff snippets for each dependent section
6. Style anchor reference + voice rules
7. Prerequisite chain (terminology inherited from prior chapters)
8. TOC slice (this chapter ±2)
9. Must-preserve terminology list
10. Reader knowledge assumptions at chapter entry
11. Downstream commitments

Dispatch `codex-collaborator MODE: CONFLICT, ROUND: 1` with the chapter plan + your reasoning. Iterate. Codex must sanity-check:

- Are independent sections actually independent?
- Are handoff snippets specific enough?
- Is the cc:codex split reasonable?
- Does the must-preserve terminology list cover everything inherited?

On AGREED:

```bash
git add _workflow/plans/<chapter_slug>_chapter_plan.md
git commit -m "plan(<N>): chapter plan agreed (<X> sections, <Y> batches, <A>cc:<B>codex)"
```

### Update STATE.md

Set reasoning fields:
- `active_chapter: <N>`
- `active_phase: 4 (per-section drafting) — Batch 1 ready to dispatch`
- `next_action: Run skill draft-batch on Batch 1 (sections <list>). Allocation: <A> cc-writer, <B> codex-writer.`

## Anti-patterns

- Do NOT proceed to Phase 4 drafting until the chapter plan is AGREED. Writer allocation is locked at this point.
- Do NOT silently apply codex's structural proposals — surface them to the user first.
- Do NOT skip handoff snippets for dependent sections — Phase 4 writers cannot see their predecessors' drafts; the snippet is their only contract.
- Do NOT draft any section content in this skill. Sections are written in Phase 4 (`draft-batch` skill).
