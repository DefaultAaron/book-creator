---
name: close-chapter
description: Phase 6 — chapter voice pass and publish. Use when all sections in the chapter have reached per-section AGREED (`workflow_status: reviewing`). Main + codex-collaborator harmonize surface concerns only (cross-section transitions, pacing, redundancy, terminology drift). No structural rewrites — those bounce back to Phase 5. On AGREED, every section's `workflow_status` flips to `complete` and one `chapter(<N>):` commit publishes the chapter with TOC + chapter-overview lockstep updates.
---

# close-chapter — Phase 6 voice pass

Verbose spec: `_workflow/pipeline_design.md` Phase 6.

## Preconditions

- Every section in the target chapter has `workflow_status: reviewing` (Phase 5 AGREED).
- No `.claude/active_writer_batch.json` (no batch in flight).
- `git status --porcelain` is clean.

## Steps

### 0. Resolve chapter and verify the **expected** section list (HARD)

Iterating only files-on-disk would silently skip a section the chapter plan listed but no one ever drafted. Resolve the **expected** section paths from the plan first, then check each:

```bash
N=<chapter number from user prompt or STATE.md active_chapter>
CHAPTER_FOLDER=$(ls -d chapter_${N}_* 2>/dev/null | head -1)
[ -z "$CHAPTER_FOLDER" ] && { echo "[FAIL] no chapter_${N}_* folder"; exit 1; }
CHAPTER_KEY="${CHAPTER_FOLDER#chapter_}"
PLAN_PATH="_workflow/plans/${CHAPTER_KEY}_chapter_plan.md"
[ -f "$PLAN_PATH" ] || { echo "[FAIL] $PLAN_PATH missing — chapter plan must exist for close-chapter"; exit 1; }

[ -z "$(git status --porcelain)" ] || { echo "[FAIL] working tree dirty — commit/stash before close-chapter"; exit 1; }
[ ! -f .claude/active_writer_batch.json ] || { echo "[FAIL] active sentinel — a writer batch is in flight; resolve before close-chapter"; exit 1; }
```

Then **read** `$PLAN_PATH` §1 (Section list) and produce the expected list of section files. For each row in §1, the expected path is `${CHAPTER_FOLDER}/${N}_<M>_<slug>.md` (where `<M>` and `<slug>` come from the row). For each expected path:

```bash
# Run this loop with EXPECTED_PATHS = the parsed list from plan §1.
FAIL=0
for f in "${EXPECTED_PATHS[@]}"; do
  if [ ! -f "$f" ]; then
    echo "[FAIL] $f listed in $PLAN_PATH §1 but file does not exist — Phase 4/5 incomplete for this section"
    FAIL=1
    continue
  fi
  STATUS=$(awk '/^---$/{s++; next} s==1 && /^workflow_status:/{print $2; exit}' "$f")
  case "$STATUS" in
    reviewing) echo "[ok]   $f at workflow_status: reviewing";;
    complete)  echo "[note] $f already complete (chapter previously published?)";;
    draft)     echo "[FAIL] $f at workflow_status: draft — Phase 5 not finished"; FAIL=1;;
    planned|"") echo "[FAIL] $f at workflow_status: ${STATUS:-<missing>} — never drafted"; FAIL=1;;
    *)         echo "[FAIL] $f has unknown workflow_status: $STATUS"; FAIL=1;;
  esac
done
[ "$FAIL" -eq 0 ] || { echo "Resolve the above before continuing with close-chapter."; exit 1; }
```

If all `[ok]`, proceed.

### 1. Read the chapter end-to-end

Read every section file in canonical order (`<N>_1` through `<N>_M`). Note:

- **Cross-section transitions** — does each section open with awareness of the previous one's payoff?
- **Pacing and redundancy** — any concept re-explained without need? Any abrupt jump in depth?
- **Surface-voice drift** — tense / register / sentence rhythm consistent across sections?
- **Terminology drift** — every must-preserve term still spelled / cased / glossed identically across sections?

Build a list of surface concerns. Anything that requires a structural rewrite is **out of scope** here — flag it and bounce that section back to Phase 5 (`section-deal-loop` skill) before continuing.

### 2. Codex CONFLICT — chapter voice pass

Dispatch `codex-collaborator MODE: CONFLICT, ROUND: 1` with:
- The chapter as a whole (concatenated section contents, or paths to read)
- The chapter plan's must-preserve terminology list (item 9)
- The style anchor reference (item 6)
- Your own list of surface concerns
- **Pending `writer-unavailable-contingency` log** — for any section in the chapter whose STATE.md `do_not_redo` still carries a `[contingency-pending-readjudication]` marker, include the contingency log (commit SHA / writer / cause / before / after / line range). Codex's voice-pass critique covers each pending contingency: accept-as-is / request revision / reject. The chapter cannot AGREE while any contingency remains unadjudicated.

Codex critiques across the chapter, focused on the same four surface concerns plus contingency adjudication. Iterate per §8.

### CONTESTED in Phase 6

Bidirectional every round. Main may push back with `CONTESTED:` per §8.1 (categories: `already-satisfied`, `technically-wrong`, `pedagogically-worse`, `out-of-scope`, `over-budget`, `chapter-context`).

`out-of-scope` here often means "this is a structural concern, not a surface one — bounce to Phase 5". If you and codex agree on that, end Phase 6, run `section-deal-loop` on the affected section, then restart Phase 6.

### Edits in Phase 6 are main-direct

Unlike Phase 5, Phase 6 surface edits are made by main session directly (writers are not re-dispatched at the chapter level). Surface edits = transition phrases, redundancy trims, tense/register tweaks, terminology fixes. **No semantic changes; no structural rewrites.**

### 3. On AGREED — flip to complete and publish

Clear any `[contingency-pending-readjudication]` markers from STATE.md `do_not_redo` (codex's adjudication closes them; if codex required a revision, the revision was applied during the voice-pass loop above before AGREED).

For every section in the chapter, update frontmatter `workflow_status: reviewing` → `workflow_status: complete`.

Update the chapter overview (`chapter_<N>_<slug>/<N>_0_overview.md`) section-status table to reflect all sections complete.

Update `00_table_of_contents.md` to mark the chapter as complete.

Single commit:

```bash
git add chapter_<N>_<slug>/ 00_table_of_contents.md
git commit -m "chapter(<N>): voice pass complete, sections <N>_1..<N>_M published"
```

### 4. Update STATE.md

- `active_chapter: <N+1> (or "all chapters complete" if last)`
- `active_phase: 1 (research) — pending user kickoff for chapter <N+1>` (or "book complete")
- `last_agreed_commit: <new sha>`
- `next_action: User can request "start chapter <N+1>" to enter the next per-chapter pipeline. Skill new-chapter handles Phases 1–3.`

## Anti-patterns

- Do NOT make structural rewrites here. If a section needs structural rework, bounce to Phase 5.
- Do NOT re-dispatch writers in Phase 6. Surface edits are main-direct (this is the one phase where main-direct on section content is the norm, because the edits are surface-only).
- Do NOT flip `workflow_status: complete` until codex AGREEs.
- Do NOT skip the lockstep TOC + chapter-overview update. The publish commit must include all three (sections + overview + TOC).
- Do NOT publish if any section still has `workflow_status: draft`. Every section must have already passed Phase 5.
