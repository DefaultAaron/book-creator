---
name: draft-batch
description: Phase 4 — dispatch one batch of independent sections to writers safely. Use when a chapter plan is AGREED and the next batch in the DAG is ready (predecessors at `workflow_status: complete` or `reviewing` with stable terminology). Encapsulates the clean-state precondition, sentinel write, parallel writer dispatch, copyback from worktree, structured post-batch validation, and sentinel cleanup.
---

# draft-batch — Phase 4 dispatch procedure

Verbose spec: `_workflow/pipeline_design.md` Phase 4 + §6.

This skill is **safety-critical**: getting the order wrong (or skipping a step) can corrupt the repo or destroy user work. Follow exactly.

## Preconditions

- Chapter plan is AGREED at `_workflow/plans/<chapter_slug>_chapter_plan.md`.
- The batch you're about to dispatch consists of sections with no unresolved upstream dependencies.
- Codex worktree exists at `../<repo-name>-codex-worktree` on branch `codex-writer-isolated` (per `bootstrap` skill).

## Steps

### 1. Build per-section briefs

For each section in the batch, write `_workflow/briefs/<chapter>_<section>_brief.md` using `_templates/_section_brief.md`. Each brief must include:

- Path constraint (the exact file path the writer is allowed to write)
- Book context paragraph + chapter context paragraph
- Section scope (in / out / depth / length band)
- Research synthesis excerpt for this section
- Handoff snippet (if dependent)
- Style anchor link + voice rules
- Framing constraints (explanation order, depth budget, allowed analogy registers)
- Terminology contract (must-preserve terms with exact spelling)
- Format requirements
- Manifest expectations

### Optional — Phase-4 brief deal-loop

For high-stakes batches (e.g. synthesis sections, late-chapter sections that integrate prior work), dispatch `codex-collaborator MODE: CONFLICT, ROUND: 1` to review the briefs **before** dispatching writers. This catches multi-axis brief defects before they propagate into the draft. Iterate to AGREED.

### 2. Full-repo clean-state precondition (HARD)

```bash
git status --porcelain
```

**If output is non-empty anywhere in the repo, ABORT.** Tell the user:

> Cannot dispatch writer batch — repo is dirty. Please commit or stash:
> <list dirty paths>

Do not work around this. The clean-state guarantee is what makes the post-batch revert safe (§6.4).

### 3. Worktree hygiene (only if any codex-writer dispatches)

If the batch includes any codex-writer dispatch, ff the worktree to current main HEAD:

```bash
REPO_NAME=$(basename "$(pwd)")
WORKTREE="../${REPO_NAME}-codex-worktree"
MAIN_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")
git -C "$WORKTREE" merge --ff-only "$MAIN_BRANCH"
git -C "$WORKTREE" status --porcelain  # must be empty; abort otherwise
```

### 4. Capture pre-batch SHA

```bash
PRE_BATCH_SHA=$(git rev-parse HEAD)
```

Save this — you'll need it for post-batch validation.

### 5. Write batch sentinel

Write `.claude/active_writer_batch.json`:

```json
{
  "allowed_paths": [
    "chapter_5_x/5_2_y.md",
    "chapter_5_x/5_3_z.md"
  ]
}
```

Use **exact paths**, not patterns. The PreToolUse hook reads this file and blocks any cc-writer Write/Edit outside this allowlist.

### 6. Dispatch all writers in ONE message

Send a single message with multiple `Agent` tool calls in parallel — one per section. Each cc-writer dispatch contains the section brief; each codex-writer dispatch contains `MODE: WRITER` + the section brief.

cc-writer dispatches operate in the main repo; the PreToolUse hook gates writes. codex-writer dispatches operate in the worktree (`--cwd ../<repo-name>-codex-worktree`); the agent file handles this internally.

Wait for **all** dispatches to return.

### 7. Copy back codex-writer outputs

For each codex-writer dispatch, copy the assigned section path from the worktree to the main repo:

```bash
cp "$WORKTREE/<assigned-path>" "./<assigned-path>"
```

(Or `git -C "$WORKTREE" show codex-writer-isolated:<path> > <path>` if you prefer not to touch worktree-side mtimes.)

### 8. Post-batch structured validation

Compute the change set:

```bash
git diff --name-only "$PRE_BATCH_SHA"
git ls-files --others --exclude-standard
```

For each modified path:
- **In sentinel allowlist** → keep.
- **Out of allowlist, modified existing file** → `git restore --source="$PRE_BATCH_SHA" -- <path>` (file-specific; never blanket `git restore .`).
- **Out of allowlist, new untracked file** → `rm <path>` (and log).
- **Rename or deletion of existing file** → forbidden; revert original from `$PRE_BATCH_SHA`, remove the new path.

Log every revert as a separate `revert(<chapter>/<section>)` commit so the audit trail is preserved.

### 9. Stage and commit in-scope writes

For each section in the batch:

```bash
git add <assigned-path>
git commit -m "wip(<chapter>/<section>): <writer> round 1 draft"
```

### 10. Remove the sentinel

```bash
rm .claude/active_writer_batch.json
```

The hook becomes permissive again. The PreCompact hook will pick this up next time it runs.

### 11. Update STATE.md

- `active_batch: none — Batch <N> just closed; <X> sections at workflow_status: draft, ready for Phase 5`
- `next_action: Run skill section-deal-loop on each section in Batch <N>: <list>. Path A for cc-drafted (<list>), Path B for codex-drafted (<list>).`

## Anti-patterns

- Do NOT skip step 2 (clean-state precondition). The post-batch revert is only safe with a clean baseline.
- Do NOT dispatch writers serially when they're independent. Single message, parallel `Agent` calls.
- Do NOT use blanket `git restore .` in step 8 — it can wipe legitimate user state. File-by-file only.
- Do NOT forget to remove the sentinel in step 10. Leaving it stale blocks all future Write/Edit calls outside its allowlist.
- Do NOT write or edit any section content yourself in this skill. This is dispatch + validation only.
