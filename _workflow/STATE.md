---
title: Workflow state snapshot
doc_type: state-snapshot
state_kind: manual_snapshot
last_updated: 2026-05-03T03:56:27.479Z
last_checked_commit: c7399644925bc83cd27ded4bf278205e81b66b7a
generated_from: scaffold
---

# Workflow state snapshot

> [!warning] NOT a source of truth
> This file is a fast-recovery snapshot for resuming work after `/compact` or `/clear`. Verify against `git log` and section-file frontmatter before acting on anything below. Mechanical fields (`last_updated`, `last_checked_commit`, `last_known_head`, `worktree_status`, `active_batch_sentinel`) are auto-refreshed by `.claude/hooks/snapshot_state.mjs` on `PreCompact`. Reasoning fields below are manually maintained by main session at each AGREED commit, each WIP commit, and at session end.

## Mechanical state (auto-refreshed by PreCompact hook)

- last_known_head: `c7399644925bc83cd27ded4bf278205e81b66b7a`
- worktree_status: dirty (main: 21 entries); codex worktree not initialized
- active_batch_sentinel: null

## Reasoning state (main session updates manually)

- active_chapter: none — Phase 0 has not started
- active_phase: 0 (book outline derivation) — pending user topic
- active_batch: none
- last_agreed_commit: none
- next_action: User has not yet provided a topic. When the user gives a topic in their first prompt, dispatch Phase 0: parallel research streams (main + gemini-researcher + codex-collaborator MODE: RESEARCH) → integrate into draft outline at `_workflow/plans/book_outline.md` → codex-collaborator MODE: CONFLICT iterates until AGREED → present to user for approval → on approval, write `00_table_of_contents.md` + per-chapter overview shells, single `outline:` commit. See `_workflow/pipeline_design.md` Phase 0 for the full procedure.

### open_conflict_threads

(none — no CONFLICT loop in flight)

### blocked_user_inputs

- Topic statement (genre, audience, language, length budget, depth band — all optional but helpful at Phase 0).

### do_not_redo

(none — first session)

## Recovery checklist after `/clear` or `/compact`

1. Read this file (`_workflow/STATE.md`) end-to-end.
2. Verify `last_known_head` matches `git rev-parse HEAD` in the main repo. If they differ, the snapshot is stale; trust git over STATE.md.
3. Read `CLAUDE.md` and `_workflow/pipeline_design.md`.
4. Read `next_action` above; cross-check it against the latest commits via `git log --oneline -10`.
5. If `active_batch_sentinel` is non-null, a writer batch is in flight — do NOT dispatch a new batch; first read the sentinel (it carries `pre_batch_sha` / `pre_revision_sha` and `dispatched_at`), then run the **stale-sentinel recovery procedure in `_workflow/pipeline_design.md` §6.5** to either resume validation, revert out-of-scope writes, or just clear the sentinel — depending on what the diff against the saved SHA shows.
6. If `open_conflict_threads` is non-empty, a CONFLICT loop is mid-iteration — resume that thread with `RESUME: true` before starting any new work.

## Resume prompt (optional — main session updates at coarse checkpoints)

> Used only at coarse checkpoints — Phase boundaries, batch boundaries, end-of-session — when `next_action` alone isn't enough to bring a fresh session up to operational speed. The freshness anchor is `for_commit`; if `last_known_head` is more than 1–2 commits ahead with anything other than `wip(...)` between them, treat this block as **stale** and use `next_action` instead.

- **for_commit:** `<sha-or-"none">`
- **paste-ready prompt to start the next session:**

```
(empty until first coarse checkpoint — main session populates with an ordered, ready-to-paste sequence: clean-state checks, files to read, dispatches to make, expected outputs, anti-patterns to avoid)
```
