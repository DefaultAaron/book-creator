---
name: section-deal-loop
description: Phase 5 — iterate one section through critique rounds until AGREED. Use after a writer has just produced a draft (or revised one) and the section is at `workflow_status: draft` or `reviewing`. Asymmetric by writer model — Path A for cc-drafted (bidirectional codex-collaborator every round), Path B for codex-drafted (main-as-conflictor rounds 1..N-1, codex-collaborator final-round sanity pass at round N). Handles the four named bias axes, gemini factual spot-check, CONTESTED pushback, and Rule 3d writer-side break.
---

# section-deal-loop — Phase 5 per-section iteration

Verbose spec: `_workflow/pipeline_design.md` Phase 5 + §5 + §8.

## Preconditions

- The section file exists at the assigned path with `workflow_status: draft` or `reviewing`.
- The chapter plan records the writer assignment (cc-writer or codex-writer) for this section. **Locked at Phase 3 — do not reassign mid-loop.**
- `.claude/active_writer_batch.json` does NOT exist (no Phase-4 batch in flight).
- `git status --porcelain` is clean.
- **Bootstrap marker present**: `.claude/bootstrap_complete.json` must exist. If missing, refuse and tell the user to run `bootstrap` first — Phase-5 codex-writer revisions depend on the same `--cwd` isolation guarantee bootstrap smoke-tests.

## One-section revision dispatch — shared procedure

Every revision (Path A every round, Path B rounds 1..N-1, Path B final-round fix, Rule 3d cc-writer fresh-eye) goes through the same dispatch shape as Phase 4 — just with a one-section sentinel instead of a batch. **Reuse this procedure verbatim** every time a writer dispatch is invoked from this skill.

**Frontmatter invariant:** the writer leaves `workflow_status: draft` unchanged on every revision in this loop. Main session flips it to `reviewing` ONLY at the per-Path "On AGREED" step below — once per section, not once per revision.

1. **Clean-state check (HARD).** `git status --porcelain` must be empty. If dirty, ABORT.
2. **Worktree hygiene** (codex-writer revisions only): `git -C "$WORKTREE" merge --ff-only $(git symbolic-ref --short HEAD 2>/dev/null || git branch --show-current)` and verify `git -C "$WORKTREE" status --porcelain` is empty. `WORKTREE="${BOOK_CREATOR_CODEX_WORKTREE:-$(cd .. && pwd)/$(basename "$(pwd)")-codex-worktree}"`.
3. **Capture pre-revision SHA**: `PRE_REVISION_SHA=$(git rev-parse HEAD)`.
4. **Write one-section sentinel** to `.claude/active_writer_batch.json` (include `pre_revision_sha` and `dispatched_at` so a crash-recovery session can apply pipeline_design §6.5 deterministically):
   ```json
   {
     "allowed_paths": ["<the-one-section-path>"],
     "pre_revision_sha": "<sha>",
     "dispatched_at": "<iso-timestamp>"
   }
   ```
5. **Dispatch the writer** (cc-writer in main repo, or codex-writer in worktree per the agent file). The brief is "revise per these critique IDs: <list>".
6. **Copy back** (codex-writer only): `cp "$WORKTREE/<path>" "./<path>"`.
7. **Validate**: `git diff --name-only "$PRE_REVISION_SHA"` should show only the one assigned path. Anything else, revert per Phase-4 §6.4 (file-specific `git restore --source="$PRE_REVISION_SHA" -- <path>`; `rm` for new untracked files).
8. **Stage and commit**: `git add <path> && git commit -m "wip(<chapter>/<section>): <writer> round <N> revision"`.
9. **Reset the codex worktree** (codex-writer revisions only): `git -C "$WORKTREE" reset --hard "$(git symbolic-ref --short HEAD 2>/dev/null || git branch --show-current)" && git -C "$WORKTREE" clean -fd`. Without this, the next round's worktree-ff check (step 2) sees the previous round's revision still sitting in the worktree and aborts.
10. **Remove the sentinel** (MUST): `rm .claude/active_writer_batch.json`. Leaving it across iterations breaks the "no batch in flight" invariant STATE.md relies on and confuses recovery after `/clear` or `/compact`.

## Path selection

Read the chapter plan's writer assignment for this section.

- **cc-writer drafted → Path A.**
- **codex-writer drafted → Path B.**

---

## Path A — cc-drafted sections (bidirectional every round)

Main session and codex-collaborator iterate every round under the §8 convergence protocol.

### Round 1

Dispatch `codex-collaborator MODE: CONFLICT, ROUND: 1` with:
- The full draft contents
- Your reasoning (what tradeoffs the writer made, what you think is strong / weak)

Codex returns 3–6 ordered objections, ending with `STILL DISAGREEING:` or (rarely round 1) `AGREED:`.

### Round N+1

For each codex critique, decide:

- **Apply** → re-dispatch the writer (cc-writer) using the **one-section revision dispatch procedure** above (clean-state check → sentinel → dispatch → copyback → validate → commit → sentinel-remove). Do not main-direct edit unless it's `writer-overhead` (spelling / dup word / broken Markdown / format artifact — no semantic changes).
- **Push back** → end your turn with `CONTESTED: <critique-id> — <category>: <one-line>`. Categories: `already-satisfied`, `technically-wrong`, `pedagogically-worse`, `out-of-scope`, `over-budget`, `chapter-context`. Codex's next round must answer this before introducing new objections.

After applying / contesting, dispatch `codex-collaborator MODE: CONFLICT, ROUND: <N+1>, RESUME: true` with the diff and your responses.

Continue until codex returns `AGREED:` AND you have no outstanding `CONTESTED:`.

### On AGREED

Update frontmatter to `workflow_status: reviewing` (it stays at `reviewing` until Phase 6 chapter voice pass — do not flip to `complete` here).

```bash
git add <section-path>
git commit -m "agreed(<chapter>/<section>): per-section deal-loop complete"
```

Then run the **producer artifact acceptance checkpoint** below if §12 names this section as a producer.

---

## Path B — codex-drafted sections (asymmetric)

Main session is the conflictor for rounds 1..N-1; codex-collaborator does the final-round sanity pass at round N.

### Rounds 1..N-1 (main as conflictor, unilateral)

For each round, write your own critique covering the standard checks (clarity, accuracy, terminology, scope creep, handoff fidelity) **plus the four named bias axes** (Rule 3c — must explicitly enumerate which axes, if any, this round flagged):

- **markdown over-listing** — over-reliance on bullet lists where prose would serve better
- **analogy register** — analogies fit for the reader's background, not model-typical-mismatched
- **foundational example choice** — entry-level examples illustrative vs overly-abstract / overly-applied
- **depth defaults** — explanation depth matches the chapter plan's depth band

If any critique remains, re-dispatch codex-writer using the **one-section revision dispatch procedure** above (clean-state check → worktree ff → sentinel → dispatch → copyback → validate → commit → sentinel-remove). Do not main-direct edit.

If no critiques remain, advance to the final-round sanity pass.

#### CONTESTED in Path B

Path B has no second adversary in rounds 1..N-1, so `CONTESTED:` does not apply. It applies only at the final round and beyond.

#### Rule 3b — gemini factual spot-check (content-risk-triggered)

If round 1 commits substantive factual claims, OR a subsequent revision **adds or materially changes** factual claims, dispatch `gemini-researcher` to verify 2–3 specific claims. Wait for verification clean before advancing toward AGREED. Do NOT auto-rerun per round — trigger is content-risk, not round-number.

### Round N — codex-collaborator final-round sanity pass

Dispatch `codex-collaborator MODE: CONFLICT, ROUND: <N>` (fresh thread or `RESUME: true` per section) with:
- The full final draft
- A brief noting "this is the final-round sanity pass; main session has already iterated N-1 rounds and finds no remaining critique"

Codex returns either:

- **AGREED:** → on to commit.
- **STILL DISAGREEING:** with critiques → handle per the §3 final-round re-review loop:
  - **(a) Re-dispatch codex-writer to fix**, then dispatch codex-collaborator for **another final-round pass on the changed text**. Loop until codex-collaborator AGREES on the actual final commit.
  - **(b) Push back via `CONTESTED:`** — bidirectional from this point.

The fix-then-AGREED-without-re-review path is **closed**. Convergence requires codex-collaborator AGREED on the actual final commit.

### On AGREED

Update frontmatter to `workflow_status: reviewing`.

```bash
git add <section-path>
git commit -m "agreed(<chapter>/<section>): per-section deal-loop complete"
```

Then run the **producer artifact acceptance checkpoint** below if §12 names this section as a producer.

---

## Producer artifact acceptance checkpoint (when §12 is non-empty)

Run after **every** AGREED commit on a section the chapter plan §12 names as a *producer*. Before any consumer section's brief is drafted, record exactly one outcome per artifact this section produces:

- **(i) Accepted as-is** — producer matches §12 spec. Add a one-line entry to STATE.md `do_not_redo`. No further action.
- **(ii) Accepted with normalization** — producer drifted *within* §12's allowed shape (a name, an ordering convention, an optional field). **Amend §12 in place** in the chapter plan with a `(normalized YYYY-MM-DD via <commit-sha>)` annotation noting the clarification. Then:
  ```bash
  git add _workflow/plans/<N>_<chapter_slug>_chapter_plan.md
  git commit -m "lockstep(<chapter>): §12 normalization — <artifact-id> — <one-line>"
  ```
  All future consumer briefs read the amended §12. Briefs NEVER derive contract shape from "as-built" producer state.
- **(iii) Rejected** — producer violates §12 (required field missing / schema semantically broken) OR the drift changes consumer argumentative burden (adds, renames, redefines, or removes a required consumer obligation). Do NOT amend §12. **Reopen the producer's Phase-5 deal-loop**: revert the just-committed `agreed(...)` commit's frontmatter flip (set `workflow_status: draft` back) and re-dispatch the writer with a brief flagging the §12-violation defect. Downstream consumer briefs are blocked until the producer reaches AGREED again.

**Boundary rule between (ii) and (iii).** Normalization may only clarify names / ordering / optional fields. It may NOT (a) remove a required field, (b) rename a required field, (c) redefine a required field's semantics, or (d) add a new required consumer obligation. Any of (a)–(d) is case (iii).

**Informal structured artifact discovered after Phase 3.** If §12 was empty (or omitted this contract) at Phase 3 but the producer is now observed to emit a structured artifact downstream sections need, this is a **Phase-3 plan defect / scope discovery** — not a §12 normalization. Stop downstream brief drafting, run a tightly-scoped Phase-3 plan deal-loop on §12 alone with codex-collaborator MODE: CONFLICT, commit as `lockstep(<chapter>): §12 scope discovery — <artifact-id> — <one-line>`, then run this acceptance checkpoint against the newly-declared §12 row. Do NOT silently amend §12 ad hoc.

If §12 is empty or this section is not named as a producer, the checkpoint is a no-op.

---

## Rule 3d — late-round writer-side break (Path B only)

If a codex-drafted section reaches **round 4 or beyond** and the residual disagreement is editorial (framing / analogy / depth, not facts), main session may dispatch a **targeted cc-writer fresh-eye revision** on the disputed passage only.

**"Same critique" trigger** (must hold across all 3+ rounds):
- Same passage (line-anchored)
- Same unresolved defect (not a paraphrase that introduces a different requested outcome)
- Same requested outcome
- **Persistent critique IDs** (e.g. `5.X-r2-c3` reused at rounds 2/3/4) — required, not gameable by varying phrasing

If the trigger fires, dispatch cc-writer with a tightly-scoped brief: "revise the following N paragraphs against main's round-N critique with the chapter plan as rubric". Use the **one-section revision dispatch procedure** above. After cc-writer returns, resume the codex deal-loop on the changed passage.

## Update STATE.md

After each AGREED:
- `last_agreed_commit: <new sha>`
- Update `next_action` to point at the next section in the batch (or, if last in batch, to `draft-batch` for the next batch / `close-chapter` if all batches done).

## Main-direct exception: `writer-unavailable-contingency`

The only main-direct section-content exceptions are `writer-overhead` (typo / dup word / broken Markdown / format artifact) AND `writer-unavailable-contingency`. Use the contingency tag only when **all** of the following hold:

- A writer dispatch was attempted and blocked by quota / rate-limit / runtime unavailability.
- The fix is **exactly one local sentence**, no new claim, no new evidence, no shifted stance, no new structure.
- The dispatch attempt is documented (timestamp, writer/model, failure mode, retry window).

Commit format:
```
main-direct: writer-unavailable-contingency — <one-line>

writer: <cc-writer | codex-writer> / <model>
cause: <one-line — e.g. "429 rate-limit", "5xx for 12 min", "quota exhausted">
attempt-ts: <ISO 8601>
retry-window: <e.g. "3× over 8 min">
before: <quoted single line>
after:  <quoted single line>
```

Add a STATE.md `do_not_redo` entry with a `[contingency-pending-readjudication]` marker referencing this commit. The next writer dispatch on this section **MUST** include a "Contingency adjudication" section in the brief listing this contingency with its before/after + cause; the writer's manifest declares accept-as-is / revise / reject. If no further writer dispatch happens before chapter close, Phase 6 codex-collaborator adjudicates the contingency at the chapter voice pass — clear the marker from `do_not_redo` only after adjudication.

Do NOT use `writer-unavailable-contingency`:
- when the writer is available but you'd rather not wait — that's a discipline violation
- for multi-sentence rewrites or structural changes — escalate to user instead
- when the change fits `writer-overhead` (typo / dup word / format artifact) — that's `writer-overhead`

Repeated use in one chapter is an audit smell — note the cause pattern in STATE.md.

## Anti-patterns

- Do NOT main-direct edit section content for anything beyond `writer-overhead` or `writer-unavailable-contingency`. Re-dispatch the writer.
- Do NOT skip the final-round sanity pass on Path B even if you think the draft is perfect.
- Do NOT auto-rerun gemini per round — content-risk trigger only.
- Do NOT flip `workflow_status` to `complete` here. That happens only at Phase 6 chapter voice pass (`close-chapter` skill).
- Do NOT mix Path A and Path B logic. Read the chapter plan's writer assignment first.
- Do NOT reassign writer mid-loop. Allocation locked at Phase 3.
- Do NOT skip the producer artifact acceptance checkpoint when §12 names this section as a producer.
- Do NOT edit a consumer brief to reflect "as-built" producer state without first amending §12 (case ii of the checkpoint). §12 is the single source of truth.
