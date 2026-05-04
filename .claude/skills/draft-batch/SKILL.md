---
name: draft-batch
description: Phase 4 — dispatch one batch of independent sections to writers safely. Use when a chapter plan is AGREED and the next batch in the DAG is ready (predecessors at `workflow_status: complete` or `reviewing` with stable terminology). Encapsulates the clean-state precondition, sentinel write, parallel writer dispatch, copyback from worktree, structured post-batch validation, and sentinel cleanup.
---

# draft-batch — Phase 4 dispatch procedure

Verbose spec: `_workflow/pipeline_design.md` Phase 4 + §6.

This skill is **safety-critical**: getting the order wrong (or skipping a step) can corrupt the repo or destroy user work. Follow exactly.

## Preconditions

- Chapter plan is AGREED at `_workflow/plans/<N>_<chapter_slug>_chapter_plan.md` (canonical stem matches the chapter folder name minus the `chapter_` prefix).
- The batch you're about to dispatch consists of sections with no unresolved upstream dependencies.
- Codex worktree exists at `${BOOK_CREATOR_CODEX_WORKTREE:-../<repo-name>-codex-worktree}` on branch `codex-writer-isolated` (per `bootstrap` skill).

## Steps

### 0. Resolve chapter, plan, and next-batch contents (HARD)

The user named a chapter and (optionally) a batch number. Main session resolves both before any dispatch:

```bash
[ -f .claude/bootstrap_complete.json ] || { echo "[FAIL] .claude/bootstrap_complete.json missing — run the bootstrap skill first (the codex --cwd smoke-test gates writer dispatch)"; exit 1; }

N=<chapter number from user prompt or STATE.md active_chapter>

# Resolve K (batch number), in this order:
#   1. If the user named a batch in their prompt, use that.
#   2. Else if `_workflow/STATE.md` `next_action` names a specific batch for chapter N, use that.
#   3. Else compute from the chapter plan (§3 Parallel batch groups + §1 Section list):
#      pick the lowest-numbered batch whose section files do NOT yet exist at workflow_status of
#      draft|reviewing|complete AND whose predecessor batches' sections are all at complete or
#      reviewing (with stable terminology). The chapter plan does NOT carry a per-batch
#      workflow_status field — readiness is derived from each section file's frontmatter.
#      If no batch qualifies (chapter is fully drafted), ABORT and route the user to
#      section-deal-loop or close-chapter instead.
K=<resolved per the rule above>

CHAPTER_FOLDER=$(ls -d chapter_${N}_* 2>/dev/null | head -1)
CHAPTER_KEY="${CHAPTER_FOLDER#chapter_}"
PLAN_PATH="_workflow/plans/${CHAPTER_KEY}_chapter_plan.md"

[ -f "$PLAN_PATH" ] || { echo "[FAIL] $PLAN_PATH missing — run new-chapter first"; exit 1; }
git log --oneline | grep -qE "^[0-9a-f]+ plan\\(${N}\\): chapter plan agreed" \
  || { echo "[FAIL] no plan(${N}): chapter plan agreed commit — chapter plan not AGREED yet"; exit 1; }
```

Then **read** `$PLAN_PATH` and extract for Batch `$K`:

- the section paths it covers (plan §1 + §3),
- their writer assignments (plan §4),
- their predecessors (plan §2 DAG),
- the cross-section artifact contracts they touch, if any (plan §12).

**Verify each predecessor section is at `workflow_status: complete` (preferred) or `workflow_status: reviewing` with stable terminology** before dispatching this batch. If any predecessor is still `draft` or `planned`, ABORT — Batch `$K` is not ready.

**§12 invariant check (HARD — fail closed).** For every section in Batch `$K` that is named in plan §12 as a *consumer* of a cross-section artifact, every producer of that artifact MUST already be at `workflow_status: reviewing` or `complete` AND the producer's §12 row MUST carry an acceptance-checkpoint annotation: either `(accepted YYYY-MM-DD via <commit-sha>)` (case i — accepted as-is) or `(normalized YYYY-MM-DD via <commit-sha>)` (case ii — accepted with normalization). If any producer is still `draft` / `planned` / absent, OR its §12 row carries no annotation, ABORT — Batch `$K` is not ready. This is belt-and-suspenders against a Phase-3 review that missed an intra-batch / out-of-order producer-consumer relationship; the primary defense is the Phase-3 codex sanity check, but dispatch-time verification fails closed.

Use the resolved section paths in step 6 (sentinel) and step 7 (dispatch); do not re-derive them later.

### 1. Full-repo clean-state precondition (HARD)

```bash
git status --porcelain
```

**If output is non-empty anywhere in the repo, ABORT.** Tell the user:

> Cannot dispatch writer batch — repo is dirty. Please commit or stash:
> <list dirty paths>

Do not work around this. The clean-state guarantee is what makes the post-batch revert safe (§6.4). The check runs **first**, before brief authoring, so brief files don't false-positive it.

### 2. Build per-section briefs

For each section in the batch, write `_workflow/briefs/<chapter>_<section>_brief.md` using `_templates/_section_brief.md`. Each brief must include:

- Path constraint (the exact file path the writer is allowed to write)
- Book context paragraph + chapter context paragraph
- Section scope (in / out / depth / length band)
- Research synthesis excerpt for this section
- Handoff snippet (if dependent)
- **Cross-section artifact contract** (only if this section is a producer or consumer in plan §12): restate the §12 row **as it currently appears in the chapter plan**, including any `(normalized YYYY-MM-DD via <commit-sha>)` annotations from previous batches' acceptance checkpoints. §12 is the single source of truth — never derive contract shape from "as-built" producer files.
- Style anchor link + voice rules
- Framing constraints (explanation order, depth budget, allowed analogy registers)
- Terminology contract (must-preserve terms with exact spelling)
- Format requirements
- **Contingency adjudication** (only if this section is being re-dispatched and STATE.md `do_not_redo` carries a `[contingency-pending-readjudication]` marker for it): list each pending `main-direct: writer-unavailable-contingency` with the before/after diff and the cause, and instruct the writer to declare accept-as-is / revise / reject per item in the manifest. The writer's resolution clears the marker.
- Manifest expectations

### Optional — Phase-4 brief deal-loop

For high-stakes batches (e.g. synthesis sections, late-chapter sections that integrate prior work), dispatch `codex-collaborator MODE: CONFLICT, ROUND: 1` to review the briefs **before** committing them and dispatching writers. This catches multi-axis brief defects before they propagate into the draft. Iterate to AGREED.

### 3. Commit briefs and re-verify clean state

The brief files are pipeline artifacts; commit them before sentinel write so the repo is clean again.

```bash
git add _workflow/briefs/<chapter>_*.md
git commit -m "wip(<chapter>): batch <K> briefs"
git status --porcelain   # MUST be empty now
```

If anything other than the just-committed briefs is dirty, ABORT — investigate before continuing.

### 4. Worktree hygiene (only if any codex-writer dispatches)

If the batch includes any codex-writer dispatch, ff the worktree to current main HEAD:

```bash
WORKTREE="${BOOK_CREATOR_CODEX_WORKTREE:-$(cd .. && pwd)/$(basename "$(pwd)")-codex-worktree}"
MAIN_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || git branch --show-current)
git -C "$WORKTREE" merge --ff-only "$MAIN_BRANCH"
git -C "$WORKTREE" status --porcelain  # must be empty; abort otherwise
```

`MAIN_BRANCH` is read from this repo's HEAD rather than `origin/HEAD` so the skill works on local-only repos and on repos using non-`main` default names (`master`, `trunk`, etc.). `BOOK_CREATOR_CODEX_WORKTREE` lets users override the default `<sibling>/<repo>-codex-worktree` location (set during `bootstrap`).

### 5. Capture pre-batch SHA

```bash
PRE_BATCH_SHA=$(git rev-parse HEAD)
```

Save this — you'll need it for post-batch validation.

### 6. Write batch sentinel

Write `.claude/active_writer_batch.json`:

```json
{
  "allowed_paths": [
    "chapter_5_x/5_2_y.md",
    "chapter_5_x/5_3_z.md"
  ],
  "pre_batch_sha": "abcd1234...",
  "dispatched_at": "2026-05-03T10:15:00Z"
}
```

Use **exact paths**, not patterns. The PreToolUse hook reads `allowed_paths` and blocks any cc-writer Write/Edit outside it. The `pre_batch_sha` and `dispatched_at` fields are not consulted by the hook; they exist so a future session that finds a stale sentinel after a crash can recover deterministically per pipeline_design.md §6.5.

### 7. Dispatch writers — cc-writers parallel, codex-writers serialized

cc-writers and codex-writers have different concurrency rules:

- **All cc-writers in the batch** are dispatched **in parallel in a single message** (multiple `Agent` tool calls). Each runs in the main repo; the PreToolUse hook gates writes per-path so disjoint section paths don't collide.
- **codex-writers in the batch are dispatched one at a time** (serially). All codex-writers share the same `--cwd "$WORKTREE"`; concurrent codex-companion task calls are not isolated by the runtime and can race on temp files / caches / partial reads of sibling files in the worktree. Serialize: dispatch codex-writer #1 → wait for return → dispatch codex-writer #2 → wait → ... If you have e.g. 3 cc-writers and 2 codex-writers in one batch, dispatch the 3 cc-writers in one parallel call **and** the first codex-writer in that same call (codex-writer #1 is parallel-safe with cc-writers because they don't share a worktree); then dispatch codex-writer #2 alone after #1 returns.

Each cc-writer dispatch contains the section brief; each codex-writer dispatch contains `MODE: WRITER` + the section brief.

Wait for **all** dispatches to return before continuing.

### 8. Copy back codex-writer outputs

For each codex-writer dispatch, copy the assigned section path from the worktree to the main repo:

```bash
cp "$WORKTREE/<assigned-path>" "./<assigned-path>"
```

(Or `git -C "$WORKTREE" show codex-writer-isolated:<path> > <path>` if you prefer not to touch worktree-side mtimes.)

### 9. Post-batch structured validation

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

The reverts themselves leave **no diff to commit** (restoring a file to its pre-batch state cancels the writer's modification; removing an untracked file produces no tracked change). To preserve the audit trail, **append one Markdown row per revert to `_workflow/validation_log.md`**, then commit that log with the `revert(...)` prefix:

```bash
cat >> _workflow/validation_log.md <<EOF
| $(date -u +%Y-%m-%dT%H:%M:%SZ) | $PRE_BATCH_SHA | <writer> | <chapter>/<section> | <reverted-path> | <out-of-scope-modified | out-of-scope-untracked | forbidden-rename | forbidden-delete> | <one-line note> |
EOF
git add _workflow/validation_log.md
git commit -m "revert(<chapter>/<section>): <writer> wrote out-of-scope path <reverted-path>"
```

If `_workflow/validation_log.md` does not yet exist, create it with the header row first:

```
| timestamp | pre_batch_sha | writer | section | reverted_path | classification | note |
|---|---|---|---|---|---|---|
```

If no out-of-scope events occurred, skip this step entirely (no log entry, no commit).

### 10. Stage and commit in-scope writes

For each section in the batch:

```bash
git add <assigned-path>
git commit -m "wip(<chapter>/<section>): <writer> round 1 draft"
```

### 11. Reset the codex worktree (only if any codex-writer ran)

After copyback + commit + validation, the codex-writer outputs are durable in main. The worktree-side copies are now stale debris. **Reset the worktree to clean state on its branch, ff'd to current main HEAD**, so the next batch's worktree-hygiene step (step 4) finds it clean instead of dirty:

```bash
WORKTREE="${BOOK_CREATOR_CODEX_WORKTREE:-$(cd .. && pwd)/$(basename "$(pwd)")-codex-worktree}"
MAIN_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || git branch --show-current)
git -C "$WORKTREE" reset --hard "$MAIN_BRANCH"
git -C "$WORKTREE" clean -fd
git -C "$WORKTREE" status --porcelain   # MUST be empty now
```

`reset --hard` is destructive **only inside the sacrificial worktree**, never in main. Files copied back to main are unaffected. Skip this step if no codex-writer ran in this batch.

### 12. Remove the sentinel

```bash
rm .claude/active_writer_batch.json
```

The hook becomes permissive again. The PreCompact hook will pick this up next time it runs.

### 13. Update STATE.md

- `active_batch: none — Batch <N> just closed; <X> sections at workflow_status: draft, ready for Phase 5`
- `next_action: Run skill section-deal-loop on each section in Batch <N>: <list>. Path A for cc-drafted (<list>), Path B for codex-drafted (<list>).`

## Anti-patterns

- Do NOT skip step 1 (clean-state precondition). The post-batch revert is only safe with a clean baseline.
- Do NOT author briefs (step 2) before the clean-state check (step 1) — the briefs themselves would dirty the repo and false-positive the check.
- Do NOT skip the brief commit (step 3) — the sentinel write in step 6 must operate on a clean working tree.
- Do NOT dispatch all writers in a single parallel call **when more than one is codex-writer**. cc-writers run parallel; codex-writers serialize (only one codex-writer may share the parallel call with cc-writers; subsequent codex-writers wait their turn). They share `--cwd "$WORKTREE"` and codex-companion does not isolate concurrent task calls per dispatch.
- Do NOT skip step 11 (worktree reset) when codex-writers ran. Without it, the next batch's worktree-hygiene check (step 4) sees a dirty tree and aborts.
- Do NOT use blanket `git restore .` in step 9 — it can wipe legitimate user state. File-by-file only.
- Do NOT forget to remove the sentinel in step 12. Leaving it stale blocks all future Write/Edit calls outside its allowlist.
- Do NOT write or edit any section content yourself in this skill. This is dispatch + validation only.
