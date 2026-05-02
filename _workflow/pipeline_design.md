---
title: Pipeline design — book-creator
doc_type: pipeline-spec
status: scaffold
last_updated: 2026-05-02
---

# Pipeline design — book-creator

This document is the **verbose authoritative spec** for the book-creator pipeline. It supersedes the lighter summary in `CLAUDE.md` whenever the two appear to conflict.

The pipeline takes a **user-defined topic** and produces a long-form book through a five-actor team running a seven-phase workflow (Phase 0 derives the book outline; Phases 1–6 run per chapter). The pipeline is topic-and-genre-agnostic: it does not assume the book is pedagogical, technical, or any specific genre. Constraints unique to a given book are introduced at Phase 0 (book outline) and at Phase 3 (per-chapter plan).

## 1. Why this shape

Drafting a book through one model session alone (a) bottlenecks on a single quota, (b) loads working context with long prose during the deal-loop, (c) leaves no durable artifact when a session crashes mid-draft, and (d) gives the prose only one model's stylistic and factual eye. This design distributes drafting across two writer subagents (one Claude, one Codex) running in parallel where chapter / section dependencies allow, while keeping main + codex CONFLICT as the single locus of plan-and-review authority and the sole gatekeepers of book-level voice.

## 2. The agent team

Five actors. Two subagent runtimes wrapping Claude Code and Codex; one wrapping Gemini; main session as orchestrator.

| Role | Runtime | Read-only? | Writes to repo? | Modes |
|---|---|---|---|---|
| **Main session** | Claude Code (this CLI) | n/a | yes — sole authority for `CLAUDE.md`, `README.md`, top-level meta files, TOC, chapter overviews, final commits | orchestrator + **conflictor for codex-drafted sections** + workflow-meta editor |
| **`gemini-researcher`** | Gemini CLI in `--approval-mode plan` | yes (read-only) | no | RESEARCH only |
| **`codex-collaborator`** | codex-companion runtime, no `--write` | yes (read-only) | no | RESEARCH \| CONFLICT (conflictor for cc-drafted sections; final-round sanity pass on codex-drafted sections) |
| **`cc-writer`** | Claude Code subagent | scoped — Read/Write/Edit only (no Bash) | yes — only the **batch-assigned section path**, hook-enforced | WRITER only |
| **`codex-writer`** | codex-companion runtime, with `--write`, run in dedicated git worktree | scoped — full write inside the sacrificial worktree only | only the assigned section path is copied back to main repo | WRITER only |

Codex appears in two distinct subagent files (`-collaborator` and `-writer`). Different invocations, no shared state. Cross-model adversarial review (main on codex-drafts; codex-collaborator on cc-drafts) is the primary same-model bias break — see §5.

Gemini's role is research-only, never critique, never drafting. Gemini also performs factual spot-checks for codex-drafted sections (§5 Rule 3b — content-risk-triggered, not round-number-narrowed).

**Conflict role split by writer model (key invariant):** main session conflicts codex-drafted sections in rounds 1..N-1; codex-collaborator does a final-round sanity pass at round N (and any subsequent rounds triggered by fixes to its critiques). codex-collaborator conflicts cc-drafted sections every round under the bidirectional protocol of §8.

## 3. The pipeline

Seven phases. AGREED gates are preserved between every adversarial step.

```
0. Book outline derivation (topic intake)
       │
       ▼
For each chapter, in canonical order:
       │
       ▼
1. Research (parallel)
       │
       ▼
2. Research deal-loop ─────────┐  (codex CONFLICT may propose
       │                       │   structural changes here)
       ▼                       │
3. Chapter plan + allocation deal-loop  (per-chapter plan brief)
       │
       ▼
4. Per-section drafting (parallel where independent)
       │
       ▼
5. Per-section deal-loop  (framing + terminology + surface voice + factual spot-check)
       │
       ▼
6. Chapter voice pass (terminal — surface harmonization only, no structural rewrites)
```

### Phase 0 — Book outline derivation

The user provides a topic (and optionally: target audience, genre, length budget, language, depth band). Main session runs three streams in parallel:

- Main session searches the repo, surveys what is already known about the topic, drafts an initial outline candidate.
- `gemini-researcher` dispatched with the topic and returns `## Findings / ## Sources / ## Open questions`.
- `codex-collaborator MODE: RESEARCH` dispatched with the same topic, returns the same three blocks.

Main integrates the three streams and drafts a **book outline** at `_workflow/plans/book_outline.md` containing at minimum:

1. **One-paragraph topic statement** — what the book is about, who it's for, what shape (pedagogical / reference / narrative / hybrid), language(s), target length band.
2. **Chapter list** — ordered, each with a one-line scope-in / scope-out summary and an estimated section count.
3. **Cross-cutting threads** — terms, motifs, or concerns that recur across chapters (so they can be enforced consistently in §3 plans later).
4. **Pedagogical / framing constraints** — register, style anchors, depth defaults, reader assumptions at book entry.
5. **Open user-input questions** — items the outline deliberately leaves to the user (e.g., specific examples, regional bias, edition pin).

`codex-collaborator MODE: CONFLICT` reviews the outline. The convergence protocol of §8 applies. **Drafting does not begin until the outline reaches AGREED and the user explicitly approves it** (Phase 0 is the only phase where user approval is mandatory — Phases 2 / 3 / 5 / 6 close on codex AGREED alone unless user intervenes).

On approval, main session writes `00_table_of_contents.md` and one `chapter_<N>_<slug>/<N>_0_overview.md` per chapter (overview shells with chapter scope, prerequisites, and an empty section table to be filled at each Phase 3). Single commit prefixed `outline:`.

### Phase 1 — Research (per chapter)

Three streams in parallel for the chapter scope:

- Main session searches the repo, reads relevant prior chapters, drafts its own findings.
- `gemini-researcher` dispatched with the chapter scope, returns the three-block format.
- `codex-collaborator MODE: RESEARCH` dispatched with the same scope, returns the same.

Main session integrates the three into a single research synthesis at `_workflow/research/<chapter_slug>_synthesis.md`. Per-section research (escalating to additional dispatches) is allowed only when a section's sourcing demands depth not covered by the chapter pass.

### Phase 2 — Research deal-loop

Main session and `codex-collaborator MODE: CONFLICT, RESUME: true` iterate on:
- what to keep / cut from the synthesis
- coverage gaps
- **structural proposals** (new section, scope shift, reorder, additions beyond the Phase 0 outline)

Convergence per §8. Structural proposals are *proposed-not-adopted*: after the research deal-loop AGREEs on scope (with the proposal noted), main session **surfaces the proposal to the user** with rationale. Adoption requires explicit user approval, after which the lockstep update across `_workflow/plans/book_outline.md` + `00_table_of_contents.md` + affected chapter overviews + `CLAUDE.md` / `README.md` (if cross-cutting threads change) runs before drafting begins.

### Phase 3 — Chapter plan + allocation deal-loop

Main session drafts a **chapter plan** at `_workflow/plans/<chapter_slug>_chapter_plan.md`, covering at minimum the following items (treat the list as a **recommended structure, not a fixed count** — items may be merged, split, or skipped based on chapter character; the codex CONFLICT review must explicitly ratify any item omitted):

1. **Section list** — file names, slugs, scope-in / scope-out, target depth, length band.
2. **Section dependency DAG** — which sections must precede which.
3. **Parallel batch groups** — independent leaves grouped for concurrent dispatch.
4. **Writer assignments** — cc-writer or codex-writer per section, with assignment rationale (§5 Rule 3a applies). **Allocation is locked at Phase-3 AGREED — no mid-run fallback.**
5. **Handoff snippets** — for each dependent section, 2–4 sentences naming what its predecessor will establish (terminology to match, assumptions to inherit).
6. **Style anchor reference** — path to a canonical completed section (or, in the first chapter, a paragraph defining the voice) + voice-rule bullet list.
7. **Prerequisite chain** — bullet list of which prior chapters establish which terminology this chapter inherits.
8. **TOC slice** — the relevant ±2 chapters of the book outline, so codex sees this chapter in context.
9. **Must-preserve terminology list** — explicit vocab from prior chapters this chapter is bound to use consistently.
10. **Reader knowledge assumptions at chapter entry** — what a reader who has finished prior chapters is expected to know.
11. **Downstream commitments** — what chapters after this one will assume from this chapter.

`codex-collaborator MODE: CONFLICT` reviews **every item present**. Specifically codex must sanity-check:
- Are independent sections actually independent? (catch DAG errors, informed by items 7–11)
- Are handoff snippets specific enough that the dependent section can reference them without seeing the predecessor's draft?
- Is the cc:codex split reasonable for this chapter's character?
- Does the must-preserve terminology list cover everything inherited from earlier chapters?

Drafting does not begin until the plan reaches AGREED.

### Phase 4 — Per-section drafting (parallel where independent)

For each batch of independent sections in the DAG:

1. Main session builds a **section brief** per section (saved at `_workflow/briefs/<chapter>_<section>_brief.md`). The brief fixes framing up front, not just scope:
   - Book context paragraph (from outline) + chapter context paragraph (from chapter plan)
   - Section scope (in / out / depth / length band)
   - Research synthesis excerpt relevant to this section
   - Handoff snippet (if dependent)
   - Style anchor link + voice-rule bullets
   - **Framing constraints** — explanation order, depth budget, allowed analogy registers (or, for non-pedagogical books, narrative point-of-view, tense, register)
   - **Terminology contract** — which must-preserve terms (from plan item 9) appear in this section and exactly how they are spelled / cased / glossed
   - Format requirements (plain Markdown, frontmatter pattern, callouts, link conventions)
   - **Path constraint**: the exact section file path the writer is allowed to write
2. Main session enforces the **full-repo clean-state precondition** (§6.1): runs `git status --porcelain` on the entire repo. If non-empty, aborts and asks user to commit/stash before continuing.
3. Main session writes the **batch sentinel** (§6.2) at `.claude/active_writer_batch.json` listing the assigned section paths for this batch — exact paths, not patterns. This is what the PreToolUse hook reads.
4. Main session dispatches all writers in the batch in a single message — multiple `Agent` tool calls in parallel, alternating cc-writer and codex-writer per the allocation ratio.
   - cc-writer dispatches operate in the main repo; the PreToolUse hook reads the sentinel and rejects writes to any path not in it.
   - codex-writer dispatches operate in the **isolated worktree** at `../<repo-name>-codex-worktree` (§6.3); main session sets the worktree branch fresh-from-main and dispatches with `--cwd` pointing at the worktree.
5. Each writer creates the assigned section file with frontmatter `workflow_status: draft` and prose body, writes only to the path given in the brief, returns to main session a short manifest: file path written, line count, any open questions for the deal-loop.
6. **Post-batch validation** (§6.4): main session computes the change set, classifies against the batch sentinel allowlist, applies structured revert / removal for any out-of-scope events, and removes the sentinel.
7. For codex-writer: after worktree-side writing succeeds, main session **copies only the assigned section path** from the worktree into the main repo and stages it for the WIP commit.

Dependent sections wait for predecessors to reach `workflow_status: complete` (or at minimum `workflow_status: reviewing` with stable terminology) before their writers are dispatched.

### Phase 5 — Per-section deal-loop

Phase 5 is **asymmetric by writer model** — the central same-model bias break.

**Path A — cc-drafted sections.** Main session and `codex-collaborator MODE: CONFLICT, RESUME: true` (per section) iterate on the draft under the bidirectional convergence protocol of §8. Both must AGREE for the section to close. Main session may push back via `CONTESTED:` (§8.1).

**Path B — codex-drafted sections.** Main session is the conflictor for rounds 1..N-1. Main session unilaterally drives the deal-loop until it has no further critiques. **Before declaring AGREED, main session dispatches `codex-collaborator MODE: CONFLICT` (fresh thread or `RESUME: true` per section) for one final-round sanity pass acting as an independent reviewer.** If codex-collaborator raises any critique at the final round, main must either:

- **(a) re-dispatch the writer (codex-writer) to fix**, then dispatch codex-collaborator for **another final-round pass on the changed text** — looping until codex-collaborator AGREES on the actual final state. The fix-then-AGREED-without-re-review path is closed; convergence requires codex-collaborator AGREED on the actual final commit, not on a pre-fix version.
- **(b) push back via `CONTESTED:` (§8.1)**, which is itself an independent-reviewer-resolvable disagreement under the bidirectional protocol of the final round.

For Path B, rounds 1..N-1 are unilateral main-session decisions; the final round (and any re-pass triggered by fixes) is bidirectional. Critique IDs persist across rounds when the concern persists (see §5 Rule 3d).

Phase 5 covers three voice/quality concerns on both paths:

- **Framing** — explanation order (or narrative shape, for non-pedagogical books), depth, analogy / metaphor choice. Already constrained by the brief; deal-loop verifies adherence.
- **Terminology consistency** — must-preserve terms from plan item 9 are used correctly.
- **Surface voice** — tense, sentence rhythm, register against the style anchor.

Plus: clarity, accuracy, depth match, handoff fidelity, scope creep.

**Codex-drafted sections additionally require a factual spot-check** (§5 Rule 3b): when a draft (round 1) or a substantial codex-writer revision adds or materially changes factual claims, main session selects 2–3 specific factual claims, dispatches `gemini-researcher` to verify, and only proceeds toward AGREED after verification returns clean. **Trigger is content-risk, not round-number** (rerun on factual changes, not auto-rerun per round).

**Codex-drafted sections — main-as-conflictor must check four named bias axes in every round** (Rule 3c absorbed into main's conflict-review prompt, axes preserved verbatim):
- **markdown over-listing** — does the draft over-rely on bullet lists where prose would serve the reader better?
- **analogy register** — are analogies fit for the reader's background, or default to model-typical-but-mismatched registers?
- **foundational example choice** — are entry-level examples illustrative of the concept, or defaulted to overly-abstract or overly-applied cases?
- **depth defaults** — does explanation depth match the section's classified depth band, or drift to model-typical-default depths?

A vague "check for codex-style bias" is insufficient; main's critique must explicitly enumerate which of the four axes (if any) the round flagged.

**Revisions go through writer dispatch — drafts AND revisions.** Re-dispatch the original writer (cc-writer for cc-drafted, codex-writer for codex-drafted) with the critique notes as the brief. The writer edits the same file in place (or in the worktree, for codex-writer), and updates frontmatter to `workflow_status: reviewing` after the first revision. The writer dispatch is wrapped with a one-section revision sentinel (same `.claude/active_writer_batch.json` shape as a Phase-4 batch sentinel, but listing only the single section path) so the path-scope hook still gates the write.

The only main-direct exception for section content is `main-direct: writer-overhead`, with a tightly narrow definition:

| Case | Examples | Commit-message tag (mandatory) |
|---|---|---|
| **writer-overhead** | **Spelling, duplicated word, broken Markdown, obvious syntax/format artifact.** No semantic changes. No sentence rewrites. If the change alters meaning, tone, framing, or technical content, dispatch the writer instead. **Use rarely.** Repeated `writer-overhead` tags in one chapter are an audit smell. | `main-direct: writer-overhead — <one-line>` |

Any non-`writer-overhead` direct section-content edit without a writer dispatch in front of it is a workflow violation. Workflow / memory / STATE.md / TOC / chapter-overview / README / CLAUDE.md edits are NOT section-content writing and remain main-direct (these are coordination, not writing).

Convergence: codex-collaborator ends each turn (Path A every round; Path B final round only) with `AGREED:` or `STILL DISAGREEING:`. **Main session may also push back** under the `CONTESTED:` protocol of §8.1. On final AGREED, frontmatter stays at `workflow_status: reviewing` until the chapter voice pass.

### Phase 6 — Chapter voice pass (terminal)

After all sections in the chapter have reached per-section AGREED, main session and `codex-collaborator MODE: CONFLICT` read across the chapter as a whole and harmonize **surface concerns only**:

- Cross-section transitions
- Pacing and redundancy
- Surface-voice smoothing (residual tense / register / rhythm drift)
- Terminology drift catch (any must-preserve term still misused)

**No structural rewrites at Phase 6.** If a section needs structural rewrite, the chapter is not ready for Phase 6 and the section goes back to Phase 5.

Edits in this phase are made by main session directly (writers are not re-dispatched at the chapter level). On AGREED, main session sets every section's frontmatter to `workflow_status: complete` and commits the chapter with TOC + chapter-overview lockstep updates bundled in.

## 4. Section file lifecycle

One file per section: `chapter_<N>_<slug>/<N>_<M>_<section_slug>.md`. (If the user wants bilingual output, the convention can be extended to `<N>_<M>_<section_slug>_<LANG>.md` — see "Customization" in `README.md`.)

Frontmatter `workflow_status` field tracks lifecycle:

| Value | Meaning |
|---|---|
| `planned` | Section exists in the chapter plan but no file yet. (TOC stub only.) |
| `draft` | Writer just produced first version. Not yet critiqued. |
| `reviewing` | One or more deal-loop revisions applied. Not yet AGREED at chapter level. |
| `complete` | Chapter voice pass AGREED, section is published. |

The field stays on the file indefinitely (no stripping). If the user later builds an export pipeline, that pipeline strips it at export time. A missing field on a section file means "unknown / legacy" and triggers a check before any deal-loop runs.

## 5. Allocation ratio and same-model bias mitigation

**Default ratio**: codex-writer-default; cc-writer reserved for chapter-classified contested-framing / high-judgment-synthesis / novel-integration sections. The codex-default tilt is a usage-budget choice — Claude budget is the binding constraint and main-session orchestration + Phase-5 Path B conflict review consumes it; codex-writer drafting consumes Codex budget instead.

There is no live quota API. The ratio is heuristic. **Writer assignment is finalized at the Phase-3 deal-loop and does not change mid-run** — there is no "codex round 1 failed → fall back to cc" path, because that judgment would itself be a high-judgment call main session should not make alone.

**Same-model bias mitigation** is now primarily structural (Phase 5 Path A vs Path B asymmetry per §3) plus a small procedural residual:

**Rule 3a — codex-default allocation, cc reserved at Phase 3.** Writer ratio defaults to codex-writer. cc-writer is reserved for sections the chapter explicitly classifies at Phase 3 as "contested framing" / "high-judgment synthesis" / "novel integration." Phase 3 plan records the rationale per section. Codex-collaborator adjudicates the allocation in the Phase-3 deal-loop. **No mid-run fallback** — once the chapter plan AGREES, writer assignment is locked.

**Rule 3b — factual spot-check on codex-drafted sections, content-risk-triggered.** In Phase 5, for any codex-written section, main session dispatches `gemini-researcher` to verify 2–3 factual claims when (i) the round-1 draft commits substantive factual claims, OR (ii) a subsequent codex-writer revision **adds or materially changes** factual claims. Main proceeds toward final-round codex-collaborator AGREED only after verification returns clean. cc-written sections do not require Rule 3b — intra-Claude critique under Path A handles them — though main may invoke gemini ad-hoc when a claim feels fragile. **Trigger is content-risk, not round-number.**

**Rule 3c — codex-bias checklist axes folded into main's conflict-review prompt.** The four axes — **markdown over-listing**, **analogy register**, **foundational example choice**, **depth defaults** — are part of main session's conflict-review prompt for every round of codex-drafted Phase 5 (Path B rounds 1..N-1). Main's critique must explicitly name which axes (if any) the round flagged.

**Rule 3d — late-round writer-side break.** If a codex-drafted section reaches **round 4 or beyond** of Phase 5 Path B and the residual disagreement is editorial (framing / analogy / depth, not facts), main session may dispatch a **targeted cc-writer fresh-eye revision** on the disputed passage only. The cc-writer dispatch carries a tightly-scoped brief ("revise the following N paragraphs against main's round-N critique with the chapter plan as rubric") and writes through a one-section revision sentinel. **"Same critique" trigger is defined by issue identity, not wording**: same passage (line-anchored), same unresolved defect (not a paraphrase that introduces a different requested outcome), same requested outcome. **Persistent critique IDs (e.g. `5.X-r2-c3` reused across rounds 2/3/4 when the concern persists) are required** so the trigger is not gameable by varying phrasing.

## 6. Path scoping and safety

The two writers have write capability scoped through four independent layers:

### 6.1 Full-repo clean-state precondition

Before any writer batch dispatches, main session runs `git status --porcelain` on the entire repo (not just the chapter folder). If output is non-empty — any modification, addition, deletion, or untracked file anywhere — dispatch is **aborted** with a user-facing message naming the dirty paths. User must commit or stash before drafting can proceed.

This eliminates the destroy-user-work scenario entirely: there is no pre-existing dirty state for post-batch validation to collide with. Cost: user cannot author elsewhere in the repo during an active drafting batch. Acceptable for a solo-author workflow.

### 6.2 cc-writer hard guard — PreToolUse hook + batch sentinel

In addition to prompt-enforced refusal language in the cc-writer agent file, a Claude Code `PreToolUse` hook configured in `.claude/settings.json` blocks Write and Edit calls on any path **not in the active batch sentinel's allowlist**.

The allowlist is **batch-specific assigned section paths**, not the wildcard `chapter_*/*.md`. During a batch dispatching cc-writer to draft `chapter_5_x/5_2_y.md`, the hook permits writes only to that exact path; writes to `chapter_5_x/5_3_z.md` (a different section in the same chapter) are also rejected.

Sentinel mechanism:
- Main session writes `.claude/active_writer_batch.json` before dispatch, containing `{"allowed_paths": ["chapter_5_x/5_2_y.md", ...]}`.
- The hook script reads this file and matches the tool input's target path against `allowed_paths` exactly (after canonicalization).
- When the sentinel does not exist, the hook is permissive (passes all paths) — main session and other subagents that legitimately edit `CLAUDE.md`, etc. are unaffected outside writer batches.
- Main session removes the sentinel after the batch completes (success or abort).

Hook script: `.claude/hooks/check_writer_path_scope.mjs`.

### 6.3 codex-writer hard isolation — dedicated git worktree

codex-writer **never operates in the main repo working tree**. Instead:

- One-time setup: `git worktree add ../<repo-name>-codex-worktree codex-writer-isolated` creates a sacrificial worktree on a long-lived branch. (The agent files derive `<repo-name>` from the current working directory's basename.)
- Before each codex-writer dispatch:
  1. Main session ensures the worktree branch is fast-forwarded from the main branch (`git -C ../<repo-name>-codex-worktree merge --ff-only <main-branch>`; if conflicts, abort and surface to user).
  2. Verifies the worktree is clean (`git -C ../<repo-name>-codex-worktree status --porcelain` is empty); if not, aborts.
  3. Dispatches codex-writer with `--cwd ../<repo-name>-codex-worktree`.
- codex-writer writes inside the worktree, returns its manifest.
- Main session copies **only the assigned section file path** from the worktree to the main repo (e.g., `cp ../<repo-name>-codex-worktree/<path> ./<path>`), then `git add` and commit in main with the `wip(...)` prefix.
- Out-of-scope writes inside the worktree (anywhere outside the assigned section path) are discarded and never touch main; they are still flagged in that section's deal-loop.
- Periodically (e.g., end of chapter), the worktree branch can be reset to discard accumulated WIP: `git -C ../<repo-name>-codex-worktree reset --hard <main-branch>`. **This `reset --hard` is destructive only inside the sacrificial codex worktree, never in the main repo.**

### 6.4 Post-batch structured validation (belt-and-suspenders)

After each writer batch returns and before the deal-loop opens, main session runs structured validation in the main repo:

- Compute change set: `git diff --name-only $PRE_BATCH_SHA` plus `git ls-files --others --exclude-standard`
- Classify each modified path against the batch sentinel allowlist
- In-scope modifications: keep
- Out-of-scope modified files: `git restore --source=$PRE_BATCH_SHA -- <path>` (file-specific, never blanket)
- Out-of-scope untracked files: `rm` (and log)
- Renames or deletions of existing files: forbidden; revert original from `$PRE_BATCH_SHA`, remove the new path
- Any out-of-scope event flagged in the offending writer's per-section deal-loop

Because §6.1 guarantees a clean repo at dispatch time, there is no pre-existing dirty state for these reverts to collide with.

### 6.5 Forbidden zones (both writers)

Regardless of layer, both writers are forbidden from touching:
- `CLAUDE.md`, `README.md`, top-level book-meta files (`00_table_of_contents.md`, etc.)
- `.claude/`, `_workflow/`, `_templates/`, `_assets/`
- Any chapter file other than the section assigned in the current brief
- `MEMORY.md` and any `~/.claude/projects/.../memory/` paths

## 7. Git commit strategy — Strategy C+ (WIP + milestones, no default squash)

Commits land at every writer return AND at every AGREED gate. Default no squashing — full WIP trail stays as audit log; user can rebase-and-squash a chapter branch later if desired.

**Commit message taxonomy** (lowercase prefixes, parsable):

| Prefix | When | Example |
|---|---|---|
| `outline:` | Phase 0 AGREED, book outline approved | `outline: book outline approved (12 chapters, ~110 sections)` |
| `wip(<chapter>/<section>)` | Every writer return | `wip(5/5_2_x): cc-writer round 1 draft` |
| `revert(<chapter>/<section>)` | Post-batch validation revert | `revert(5/5_2_x): out-of-scope edit to README.md by cc-writer` |
| `agreed(<chapter>/<section>)` | Phase 5 AGREED on a section | `agreed(5/5_2_x): per-section deal-loop complete` |
| `plan(<chapter>)` | Phase 2 or 3 AGREED | `plan(5): research synthesis agreed` |
| `chapter(<N>)` | Phase 6 AGREED, chapter published | `chapter(5): voice pass complete, sections 5_1..5_7 published` |
| `lockstep(<topic>)` | Multi-artifact lockstep update outside the per-chapter pipeline | `lockstep(workflow): updated phase 5 protocol` |

Filter examples:
- Milestones only: `git log --grep '^chapter('`
- Drafting trail: `git log --grep '^wip(' --grep '^revert(' -E`
- A specific section's history: `git log --grep '5/5_2_x'`

User-edit collisions are eliminated by §6.1 (clean-state precondition).

## 8. Convergence protocol

Every `codex-collaborator` CONFLICT-mode response ends with exactly one of:
- `STILL DISAGREEING: <one-line>` — main session dispatches round N+1 with `RESUME: true`.
- `AGREED: <one-line>` — phase complete (Path A every round; Path B final round only).

Trivial / docs-only / single-sentence edits skip the deal-loop entirely.

This protocol applies in Phase 0 (outline), Phase 2 (research), Phase 3 (plan + allocation), Phase 5 (per-section drafts), and Phase 6 (chapter voice pass). Phase 1 (parallel research) and Phase 4 (parallel drafting) are not adversarial.

**Phase 5 asymmetry:**
- **Path A — cc-drafted sections.** Bidirectional every round: codex-collaborator critiques, main session may push back via `CONTESTED:` (§8.1). Convergence requires both AGREED.
- **Path B — codex-drafted sections.** Main session is the conflictor for rounds 1..N-1; codex-collaborator is the conflictor at round N (and any re-pass triggered by fixes). Rounds 1..N-1 are unilateral main-session decisions; the final round is bidirectional. **`CONTESTED:` applies only at the final round and beyond** in Path B — main session cannot CONTEST itself in earlier rounds.

**Final-round re-review loop (Path B):** If codex-collaborator's final-round critique results in a fix, the fix itself requires another codex-collaborator pass on the changed text. Convergence requires codex-collaborator AGREED on the actual final commit, not on a pre-fix version.

**Phase 0 / 2 / 3 / 6** remain bidirectional every round under codex-collaborator CONFLICT mode (these phases do not split by writer model because they are not section-content-writing phases).

### 8.1 `CONTESTED:` — main session pushback

Codex's marker is one half of the convergence. **Main session may push back when a critique is wrong, off-target, or out of scope.** The default is implicit: if main applies the critique fully, no main-side marker is required beyond the normal WIP commit summary. When main does **not** fully apply a substantive critique, main ends the revision turn with:

```
CONTESTED: <critique-id-or-summary> — <rationale-category>: <one-line argument>
```

Allowed rationale categories (closed list — choose the one that fits, do not invent new ones):

| Category | Use when |
|---|---|
| `already-satisfied` | The critique describes a problem the draft already addresses; main argues codex misread the section. |
| `technically-wrong` | The critique's technical claim is incorrect (with evidence). |
| `pedagogically-worse` | Following the critique would degrade explanation, not improve it. (For non-pedagogical books, read as "stylistically-worse" / "narratively-worse".) |
| `out-of-scope` | The critique points at material owned by another section / chapter; not §X.Y's job. |
| `over-budget` | The critique would push length, depth, or scope past the chapter plan's bound for this section. |
| `chapter-context` | The critique is locally reasonable but conflicts with a binding chapter-level decision (style anchor, terminology contract, prerequisite chain). |

Codex's next CONFLICT round must answer the contested rationale **before** introducing new objections. A `CONTESTED:` does not terminate the loop; the convergence rule remains "both sides AGREED." Codex either concedes (returns `AGREED:`) or sharpens its objection (returns `STILL DISAGREEING:` with revised reasoning that addresses main's argument).

`CONTESTED:` items are logged in WIP commit messages **only when they materially affect the section**, not for tiny wording choices. Repeated `CONTESTED:` entries from main on the same section across multiple rounds are an audit smell — main is either right (and codex should converge) or stalling (and should accept the critique).

## 9. Modification discipline (load-bearing)

- **Never apply a modification before codex `AGREED`** at the relevant phase. Including for workflow / meta-architecture changes — not just book content. Direct user instructions that change the agreed plan still go through the deal loop first.
- **Never act on downstream artifacts before the user explicitly approves the plan.** "Give me the plan" means present-then-wait, not implement.
- When changing anything substantive, **update `CLAUDE.md` + `README.md` + `_workflow/pipeline_design.md` + `00_table_of_contents.md` + affected chapter overviews together** so the sources never drift.

The structural-change gate in Phase 2 makes this explicit: a structural proposal from codex requires user approval, then lockstep updates, before drafting begins.

## 10. Live workflow state — `_workflow/STATE.md`

`_workflow/STATE.md` is a **fast-recovery snapshot** of where the book is in the pipeline (active phase, active batch, next action, open CONFLICT threads, do-not-redo notes). **NOT a source of truth** — verify against `git log` and section-file frontmatter before acting on anything below.

Mechanical fields (`last_updated`, `last_checked_commit`, `last_known_head`, `worktree_status`, `active_batch_sentinel`) are auto-refreshed by the `PreCompact` hook (`.claude/hooks/snapshot_state.mjs`).

Reasoning fields (`active_chapter`, `active_phase`, `active_batch`, `last_agreed_commit`, `next_action`, `open_conflict_threads`, `blocked_user_inputs`, `do_not_redo`) are owned by main session and updated at every WIP commit, every AGREED commit, and at session end.

A `SessionStart` hook (matchers `clear` + `compact`) emits a one-line reminder to read STATE.md after context loss.

## 11. Initial setup (one-time, per book project)

1. Clone or copy this scaffold into a new repo named after the book project (or topic).
2. Initialize git: `git init && git add . && git commit -m "scaffold: book-creator pipeline"`.
3. Create the codex-writer worktree:
   ```bash
   git worktree add ../$(basename "$(pwd)")-codex-worktree -b codex-writer-isolated
   ```
4. Open Claude Code in the repo root and give it a topic. Phase 0 will run.

## 12. Why this is worth doing

1. **Quota durability.** Distributing drafting across two writer quotas means single-model quota exhaustion no longer halts the book. Sections in flight survive on disk between sessions, with WIP commits making every revision recoverable.
2. **Speed.** Independent sections drafted in parallel. A 6-section chapter that would take six serial drafting rounds collapses to two batches of three (or similar) plus voice-pass.
3. **Context economy on main session.** Main session no longer carries long drafts in its working context — files are on disk, main session reads during the deal-loop and otherwise holds only briefs and critique notes.
4. **Cross-model adversarial review.** Same-model bias is broken structurally: main critiques codex-drafts, codex critiques cc-drafts, gemini factually spot-checks codex-drafts. No section is signed off by the model that wrote it.

The design pays for these with: (a) more agent files and a hook to maintain, (b) a sacrificial git worktree for codex-writer, (c) coordination overhead for handoff snippets and dependency batching, (d) the user must keep the main repo clean during active drafting batches.
