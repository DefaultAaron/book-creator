---
name: bootstrap
description: First-time setup for a new book-creator project. Creates the initial commit, sets up the codex-writer git worktree, verifies hooks load, and confirms the Codex + Gemini CLIs are reachable. Run once after cloning the scaffold (or when the user explicitly says "bootstrap" / "set up the worktree" / "is everything wired").
---

# bootstrap

Use this skill exactly once per book project, immediately after cloning the scaffold. It performs the eight one-time setup steps the pipeline assumes are already done — initial commit, default-branch detection, worktree path resolution + creation, codex `--cwd` smoke-test, hook verification, Gemini reachability, and (optional) permission setup.

## Preconditions

- The repo is a git repo (`.git/` exists) but may have no commits yet.
- The user has Codex (codex-companion plugin) and Gemini (`gemini` CLI) installed and reachable.

## Steps

### 1. Initial scaffold commit (if HEAD is unborn)

Check whether the repo has any commits:

```bash
git rev-parse HEAD 2>/dev/null
```

If this fails (unborn HEAD), make the scaffold commit:

```bash
git add .
git commit -m "scaffold: book-creator pipeline"
```

If commits exist already, skip — do not amend.

### 2. Detect default branch

```bash
DEFAULT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || git branch --show-current)
echo "default branch: $DEFAULT_BRANCH"
```

The pipeline does not assume `main`. Whatever name the user's git config produced (`main`, `master`, `trunk`, etc.) is what the skills will use, via `git symbolic-ref --short HEAD` at runtime. Record `$DEFAULT_BRANCH` in your bootstrap report.

### 3. Resolve and (optionally) override the worktree path

The default location is `../<repo-name>-codex-worktree` (a sibling of the main repo). For uncommon cases — same basename in two parent directories, or a path with spaces, or a non-default filesystem layout — the user can override via the `BOOK_CREATOR_CODEX_WORKTREE` environment variable.

```bash
WORKTREE_PATH="${BOOK_CREATOR_CODEX_WORKTREE:-$(cd .. && pwd)/$(basename "$(pwd)")-codex-worktree}"
echo "codex worktree path: $WORKTREE_PATH"
```

If `BOOK_CREATOR_CODEX_WORKTREE` is set, recommend the user persists it in their shell profile so future sessions inherit the same value (the snapshot hook and codex-writer agent both read it).

### 4. Create the codex-writer worktree

The pipeline requires a sacrificial git worktree at `$WORKTREE_PATH` for codex-writer to write into safely. Create it once:

```bash
git worktree add "$WORKTREE_PATH" -b codex-writer-isolated
```

If the worktree already exists, skip. Verify with:

```bash
git worktree list
```

You should see two entries: the main worktree and the codex worktree on `codex-writer-isolated`.

### 5. Smoke-test codex `--cwd` isolation

The whole codex-writer safety story rests on Codex respecting `--cwd "$WORKTREE_PATH"` and not escaping it to mutate the main repo. Smoke-test this once during bootstrap so misconfiguration is caught here, not during a Phase-4 batch.

```bash
CODEX_SCRIPT=$(printf '%s\n' "$HOME"/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs 2>/dev/null | sort -V | tail -1)
if [ -z "$CODEX_SCRIPT" ] || [ ! -f "$CODEX_SCRIPT" ]; then
  echo "[FAIL] codex-companion.mjs not found — install the openai-codex Claude Code plugin"
  exit 1
fi

PROBE="bootstrap_smoke_$(date +%s).txt"
PRE_HEAD=$(git rev-parse HEAD)

node "$CODEX_SCRIPT" task --model gpt-5.5 --write --cwd "$WORKTREE_PATH" \
  "Create a file named $PROBE in the current directory containing the single word OK. Do nothing else."

CLEANUP_OK=true

# Test 1: probe must exist in the worktree.
if [ -f "$WORKTREE_PATH/$PROBE" ]; then
  echo "[ok]   codex wrote inside worktree"
  rm -f "$WORKTREE_PATH/$PROBE"
else
  echo "[FAIL] codex did not create $PROBE inside the worktree — codex --write may not be honored"
  CLEANUP_OK=false
fi

# Test 2: main repo must be unchanged. ABORT if not.
if [ "$(git rev-parse HEAD)" = "$PRE_HEAD" ] && [ -z "$(git status --porcelain)" ]; then
  echo "[ok]   main repo untouched by codex --cwd"
else
  echo "[FAIL] codex escaped --cwd and mutated the main repo — DO NOT proceed with codex-writer dispatches"
  echo "       Investigate the codex-companion install and re-run bootstrap."
  # Best-effort cleanup of any leftover probe in the main repo so the user can re-run bootstrap.
  rm -f "./$PROBE"
  exit 1
fi

[ "$CLEANUP_OK" = "true" ] || exit 1
```

This step ABORTS bootstrap on either failure mode. Do not silently continue.

**Known smoke-test limitations.** The probe asks Codex to perform a single file write inside `--cwd`. False negatives are possible if Codex declines the task for unrelated reasons (rate limit, sandbox refusal, model-availability error). If the worktree probe is missing AND the main repo is clean, re-run step 5 once before declaring failure; if it fails again, escalate as `codex --write may not be honored` and stop. False positives (Codex appears to respect `--cwd` but actually escapes it for some other tool call) are not catchable by a single probe — the layered defenses in §6 (sentinel + post-batch validation) are the durable guard.

### 6. Verify hooks load

Tell the user to run `/hooks` in the Claude Code prompt. Expected output: four hook entries — `UserPromptSubmit`, `PreToolUse Write|Edit`, `PreCompact manual|auto`, `SessionStart clear|compact`. If any are missing, check `.claude/settings.json`.

### 7. Verify Gemini reachable

```bash
command -v gemini && gemini --version
```

If `gemini` is not on PATH, the user needs to install the Gemini CLI.

(Codex was already verified in step 5 by the smoke-test running successfully.)

### 8. Optional — recommend permissions

If the user wants to skip per-tool-call approval prompts for the routine Codex / Gemini Bash invocations, suggest copying `.claude/settings.local.json.example` to `.claude/settings.local.json` (which is git-ignored) and reviewing the permissions block.

### 9. Write the bootstrap marker

Downstream skills (`new-book`, `new-chapter`) gate on this marker — they refuse to start until they see it. Write a JSON file at `.claude/bootstrap_complete.json` (git-ignored per `.gitignore`):

```bash
cat > .claude/bootstrap_complete.json <<EOF
{
  "completed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "default_branch": "$DEFAULT_BRANCH",
  "worktree_path": "$WORKTREE_PATH",
  "smoke_test": "passed"
}
EOF
```

Add `.claude/bootstrap_complete.json` to `.gitignore` if it isn't already (it's per-machine state, not source).

## Done

Report status to the user as a multi-line table:

```
[ok]   initial commit
[ok]   default branch: <name>
[ok]   codex worktree at <path>
[ok]   codex --cwd isolation smoke-test
[ok]   hooks loaded (4)
[ok]   codex + gemini reachable
```

Or `[FAIL]` with the failure reason. Do not proceed to Phase 0 until all are `[ok]`.

## Anti-patterns

- Do NOT run `git worktree add` if the worktree already exists — it errors and confuses the user.
- Do NOT amend the scaffold commit; create a new commit if there's anything to fix.
- Do NOT pre-emptively dispatch any subagent here — bootstrap is local repo setup only.
- Do NOT skip the codex-cwd smoke-test (step 5). It validates the safety guarantee the rest of the pipeline depends on.
