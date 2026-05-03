---
name: new-book
description: Phase 0 — derive a book outline from a user-given topic. Use when the user has provided a topic (and optionally audience / genre / language / length) and there is no `_workflow/plans/book_outline.md` yet, or when they ask to "start a new book" / "outline a book on X". Runs parallel research → drafts outline → codex CONFLICT loop → presents to user for approval → on approval, writes TOC and per-chapter overview shells.
---

# new-book — Phase 0 outline derivation

This skill runs **Phase 0** of the pipeline. Phase 0 is the only phase where user approval is mandatory. Verbose spec: `_workflow/pipeline_design.md` Phase 0.

## Preconditions

- `bootstrap` skill has completed (initial commit, codex worktree exists, hooks load, Codex + Gemini reachable).
- `_workflow/plans/book_outline.md` does not exist (or user explicitly wants to redo the outline).
- User has provided a topic in the current message or a prior turn.

If the topic is vague, ask one clarifying question covering: target audience, genre (pedagogical / reference / narrative / hybrid), language, target length band, depth band. Don't ask more than one round — make reasonable assumptions and surface them as open questions in the outline.

## Steps

### 0. Bootstrap precondition check (HARD)

Before any research dispatch, verify bootstrap completed. Each check prints `[ok]` or `[FAIL]` so missing prerequisites cannot be silently glossed over:

```bash
FAIL=0

# The bootstrap marker is the single source of truth — bootstrap writes it as its last step
# only after all 8 checks (initial commit, default branch, worktree path, worktree create,
# codex --cwd smoke-test, hooks, gemini, optional permissions) pass.
if [ -f .claude/bootstrap_complete.json ]; then
  echo "[ok]   bootstrap marker present ($(cat .claude/bootstrap_complete.json))"
else
  echo "[FAIL] .claude/bootstrap_complete.json missing — run the bootstrap skill first (it includes the codex --cwd smoke-test that catches misconfigurations Phase 0 will not)"
  FAIL=1
fi

# Belt-and-suspenders: also verify the live state in case bootstrap was run but the worktree
# was later removed manually, or codex/gemini were uninstalled.
git rev-parse HEAD >/dev/null 2>&1 || { echo "[FAIL] no commits yet"; FAIL=1; }
git worktree list | grep -q codex-writer-isolated || { echo "[FAIL] codex worktree gone — re-run bootstrap"; FAIL=1; }
CODEX_SCRIPT=$(printf '%s\n' "$HOME"/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs 2>/dev/null | sort -V | tail -1)
[ -n "$CODEX_SCRIPT" ] && [ -f "$CODEX_SCRIPT" ] || { echo "[FAIL] codex-companion.mjs not found"; FAIL=1; }
command -v gemini >/dev/null 2>&1 || { echo "[FAIL] gemini CLI not on PATH"; FAIL=1; }

[ "$FAIL" -eq 0 ] || { echo "Run the bootstrap skill before continuing with new-book."; exit 1; }
```

Phase 0 dispatches gemini and codex in parallel; missing prerequisites here would silently fail later in the pipeline.

### 1. Parallel research (no adversarial review)

Dispatch three streams in **a single message with three parallel `Agent` tool calls**:

- Main session: search the repo for any prior context, then draft your own findings on the topic.
- `gemini-researcher`: dispatch with the topic + one paragraph of context (target audience, genre, etc. as known). Returns `## Findings / ## Sources / ## Open questions`.
- `codex-collaborator MODE: RESEARCH`: dispatch with the same topic + context. Returns the same three blocks.

Wait for both subagents to return.

### 2. Integrate into draft outline

Read all three streams. Write `_workflow/plans/book_outline.md` using `_templates/_book_outline.md` as the structure. Cover:

1. **Topic statement** — what the book is about, who it's for, shape (pedagogical / reference / narrative / hybrid), language, target length band, reader's prior knowledge.
2. **Chapter list** — ordered, each with one-line scope-in / scope-out and estimated section count. Match ordering to the genre's natural flow (prerequisites first for pedagogical; chronological / thematic / alphabetical as appropriate for others).
3. **Cross-cutting threads** — terms, motifs, or concerns that recur across chapters.
4. **Framing constraints** — register / voice / depth defaults / reader assumptions / style anchors.
5. **Open user-input questions** — items deliberately left to the user (specifics you couldn't resolve from research alone).

Do **not** silently make critical decisions; surface them as open questions.

### 3. Codex CONFLICT deal-loop

Dispatch `codex-collaborator MODE: CONFLICT, ROUND: 1` with the draft outline + your reasoning (why this chapter ordering, why this depth, what tradeoffs).

Iterate per the convergence protocol: each codex round ends with `STILL DISAGREEING:` or `AGREED:`. On `STILL DISAGREEING:`, revise the outline (or push back via `CONTESTED:` if the critique is wrong/off-target/out-of-scope), then dispatch with `RESUME: true, ROUND: <N+1>`. Continue until both sides AGREE.

### 4. Present to user for approval

Once codex AGREEs, present the outline to the user with a clear approval ask:

> The outline below has reached AGREED with codex-collaborator. Approving will:
> - commit `_workflow/plans/book_outline.md`
> - create `00_table_of_contents.md`
> - create `chapter_<N>_<slug>/<N>_0_overview.md` for each chapter
>
> Open user-input questions: <list from outline §5>
>
> Approve, request revisions, or reject?

**Wait for explicit approval.** Do not proceed without it. If the user requests revisions, edit the outline directly (this is plan-level, not section-content; main-direct edits are fine) and re-present. If the user wants codex to re-review the revisions first, dispatch another CONFLICT round.

### 5. Lockstep apply on approval

On approval, in a single message, write all of:

- `00_table_of_contents.md` — the live progress tracker (chapter list with section status legend).
- One `chapter_<N>_<slug>/<N>_0_overview.md` per chapter, using `_templates/_chapter_overview.md` (filled with chapter scope, learning objectives / goals, prerequisites, empty section table).
- (Optional) `reading_list.md` at repo root, **only if** the book is research-heavy (non-fiction, technical, academic) AND the user / outline calls for a reading list. Seed it with one `## Chapter <N> — <Title>` heading per chapter and a one-line note "use `_templates/_reading_list_entry.md` for entries". For fiction, narrative, short-form, or any book where a reading list adds no value, **skip this file** — do not create an empty placeholder. Decide explicitly during outline drafting (item §1 of the outline) and surface the decision to the user before approval.

Then commit (paths conditional on what was created):

```bash
git add _workflow/plans/book_outline.md 00_table_of_contents.md chapter_*/
[ -f reading_list.md ] && git add reading_list.md
git commit -m "outline: <one-line summary, e.g. 'book outline approved (12 chapters, ~110 sections)'>"
```

### 6. Update STATE.md

Set reasoning fields:
- `active_phase: 1 (research) — pending user kickoff for chapter 1`
- `last_agreed_commit: <new sha>`
- `next_action: User can request "start chapter 1" (or any specific chapter) to enter the per-chapter pipeline. Skill new-chapter handles Phases 1–3.`

## Anti-patterns

- Do NOT proceed past step 4 without explicit user approval.
- Do NOT silently resolve open user-input questions — surface them.
- Do NOT skip the CONFLICT loop even if the first draft seems great. Cross-model review at outline level catches genre / scope / ordering issues that propagate expensively if missed.
- Do NOT draft any section content here. This skill ends with chapter overview shells (status: planned). Section drafting is `draft-batch` (Phase 4) after `new-chapter` (Phases 1–3).
