---
title: Workflow state snapshot
doc_type: state-snapshot
state_kind: manual_snapshot
last_updated: <not yet seeded>
last_checked_commit: <not yet seeded>
generated_from: scaffold
---

# Workflow state snapshot

> [!warning] NOT a source of truth
> This file is a fast-recovery snapshot for resuming work after `/compact` or `/clear`. Verify against `git log` and section-file frontmatter before acting on anything below.
>
> **Mechanical fields shipped as `<not yet seeded>`.** They are auto-refreshed by `.claude/hooks/snapshot_state.mjs` on `PreCompact` — i.e. when context compaction runs (typically `/compact`). They will show placeholders until that first `PreCompact` event triggers the snapshot. We do NOT seed them at `bootstrap` time, because the seeding commit itself would change `HEAD` and immediately re-stale `last_known_head` — placeholders are more honest than fresh-but-stale values.
>
> Reasoning fields below (`active_chapter`, `active_phase`, `active_batch`, `last_agreed_commit`, `next_action`, `open_conflict_threads`, `blocked_user_inputs`, `do_not_redo`) are manually maintained by main session at each AGREED commit, each WIP commit, and at session end.

## Mechanical state (auto-refreshed by PreCompact hook)

- last_known_head: <not yet seeded>
- worktree_status: <not yet seeded>
- active_batch_sentinel: <not yet seeded>

## Reasoning state (main session updates manually)

- active_chapter: none — Phase 0 has not started in this repo (this is the OSS scaffold itself, not a book project; bootstrap is intentionally NOT run here)
- active_phase: 0 (book outline derivation) — pending user topic in any downstream clone; the scaffold repo itself does not run Phase 0
- active_batch: none
- last_agreed_commit: `2b9b3fd` (scaffold v2 series AGREED — producer artifact acceptance checkpoint + writer-unavailable-contingency audit tag)
- next_action: Two parallel options. **(A) Use the scaffold for a real book** — clone this repo elsewhere, run the `bootstrap` skill, then provide a topic to start Phase 0. **(B) Continue scaffold maintenance in this repo** — the v2 series is AGREED and there is no outstanding meta-design loop. If the user asks to push the 7 commits ahead of `origin/main`, do that explicitly. Otherwise wait for direction.

### open_conflict_threads

(none — v2 series codex-collaborator deal-loop AGREED at round 6 / commit `2b9b3fd`. No further CONFLICT iterations pending.)

### blocked_user_inputs

- (None blocking — scaffold is release-ready as of `2b9b3fd`. User may optionally choose to push to origin, tag a release, or move on to a book-project clone.)

### do_not_redo

- **Scaffold v2 series AGREED at commit `2b9b3fd` after 6 codex-collaborator CONFLICT rounds (2026-05-04 / 2026-05-05).** Two patterns extracted from the auto-driving source project's Ch 5/6 procedural learnings, generalized into the scaffold:
  1. **Producer artifact acceptance checkpoint** — runs at every Phase-5 AGREED on a section the chapter plan §12 names as a producer of a cross-section artifact. Three outcomes per artifact: (i) accepted as-is — annotate §12 row with `(producer <N>.<m>: accepted YYYY-MM-DD via <agreed-sha>)`; (ii) accepted with normalization — amend §12 row + add `(producer <N>.<m>: normalized YYYY-MM-DD via <agreed-sha>)` annotation; (iii) rejected — reopen producer's deal-loop. `<agreed-sha>` is the producer's own `agreed(...)` SHA (never self-referential to the in-flight lockstep commit). Per-producer for multi-producer rows. **Replace existing clause on re-AGREED** (never two live clauses for the same producer). `draft-batch` step 0 enforces a 4-condition §12 invariant check at dispatch time: workflow_status reviewing/complete + exactly one current clause per producer + latest-agreed-sha match (anchored extended-regex `git log --grep="^agreed\(${CHAPTER}/${PRODUCER_SECTION}\): "`) + no duplicate live clauses. §12 is the single source of truth — briefs never derive contract shape from "as-built" producer files. Phase-3 codex sanity-check rejects intra-batch producer→consumer §12 rows as DAG/allocation errors. Informal structured artifacts discovered after Phase 3 are Phase-3 plan defects: stop downstream briefs, run a tightly-scoped Phase-3 plan deal-loop on §12, commit `lockstep(<chapter>): §12 scope discovery — ...`, then run the acceptance checkpoint.
  2. **`main-direct: writer-unavailable-contingency` audit tag** — counterpart to `writer-overhead` for the case where a writer dispatch was attempted and blocked by quota/rate-limit/runtime unavailability AND the fix is exactly one local sentence (no new claim, evidence, stance, or structure). Audit floor in commit body: `writer / cause / attempt-ts / retry-window / before / after`. STATE.md `[contingency-pending-readjudication]` marker stays open until the next writer dispatch on the section adjudicates it (mandatory "Contingency adjudication" section in the brief; writer's manifest declares accept-as-is / revise / reject), or — if no further dispatch happens — Phase 6 codex-collaborator adjudicates it at the chapter voice pass with a surface-edit-scope guardrail (semantic restructures bounce back to Phase 5).
- Lockstep commit ladder for the v2 series: `49ee953` (v2 draft) → `97c7b43` (round-2 residuals) → `fb658af` (round-3 residual) → `45bf0df` (round-4 residuals) → `0a4c18c` (round-5 residual) → `2b9b3fd` (round-6 AGREED + polish). All seven prior commits in the repo's history (`c739964` INIT through `2b9b3fd` v2 polish) are part of the AGREED scaffold.
- Two pre-v2 lockstep commits already AGREED before this session: `7471e1c` (release-ready scaffold after 5 codex rounds) and `a805c78` (writer-revision discipline + STATE.md placeholders + actor-table fix).

## Recovery checklist after `/clear` or `/compact`

1. Read this file (`_workflow/STATE.md`) end-to-end.
2. Verify `last_known_head` matches `git rev-parse HEAD` in the main repo. If they differ, the snapshot is stale; trust git over STATE.md.
3. Read `CLAUDE.md` and `_workflow/pipeline_design.md`.
4. Read `next_action` above; cross-check it against the latest commits via `git log --oneline -10`.
5. If `active_batch_sentinel` is non-null, a writer batch is in flight — do NOT dispatch a new batch; first read the sentinel (it carries `pre_batch_sha` / `pre_revision_sha` and `dispatched_at`), then run the **stale-sentinel recovery procedure in `_workflow/pipeline_design.md` §6.5** to either resume validation, revert out-of-scope writes, or just clear the sentinel — depending on what the diff against the saved SHA shows.
6. If `open_conflict_threads` is non-empty, a CONFLICT loop is mid-iteration — resume that thread with `RESUME: true` before starting any new work.

## Resume prompt (optional — main session updates at coarse checkpoints)

> Used only at coarse checkpoints — Phase boundaries, batch boundaries, end-of-session — when `next_action` alone isn't enough to bring a fresh session up to operational speed. The freshness anchor is `for_commit`; if `last_known_head` is more than 1–2 commits ahead with anything other than `wip(...)` between them, treat this block as **stale** and use `next_action` instead.

- **for_commit:** `2b9b3fd`
- **paste-ready prompt to start the next session:**

```
This is the book-creator OSS scaffold repo (NOT a book project clone). Scaffold v2 series AGREED at commit 2b9b3fd after 6 codex-collaborator CONFLICT rounds. No outstanding meta-design loop, no codex worktree, no bootstrap marker. Branch is ahead of origin/main by 7 commits.

Before doing anything:
1. `git rev-parse HEAD` should equal `2b9b3fd`. If HEAD is more commits ahead with anything other than `wip(...)` between them, this resume prompt is stale — read STATE.md `next_action` instead.
2. `git status --porcelain` MUST be empty.
3. There is intentionally NO `.claude/bootstrap_complete.json` and NO codex worktree in this repo — do NOT run bootstrap here. Bootstrap is for downstream clones using the scaffold for a real book project.

Two valid next moves:
- (A) If user wants to push the AGREED scaffold to origin or tag a release: `git push` and/or `git tag` per their explicit instruction. Do not push without an explicit ask.
- (B) If user wants to continue scaffold maintenance: read STATE.md `do_not_redo` to see what's already AGREED so the loop isn't re-litigated, then take their direction.
- (C) If user wants to start a real book: this repo is the wrong place — they need to clone it elsewhere, run `bootstrap`, then give a topic.

Do NOT dispatch codex-collaborator preemptively. Do NOT modify CLAUDE.md / README.md / pipeline_design.md / templates / skills without an explicit user request that has already been through the codex deal-loop per §9 modification discipline.
```
