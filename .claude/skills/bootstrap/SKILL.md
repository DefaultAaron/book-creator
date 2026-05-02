---
name: bootstrap
description: First-time setup for a new book-creator project. Creates the initial commit, sets up the codex-writer git worktree, verifies hooks load, and confirms the Codex + Gemini CLIs are reachable. Run once after cloning the scaffold (or when the user explicitly says "bootstrap" / "set up the worktree" / "is everything wired").
---

# bootstrap

Use this skill exactly once per book project, immediately after cloning the scaffold. It performs the four one-time setup steps that the pipeline assumes are already done.

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

### 2. Create the codex-writer worktree

The pipeline requires a sacrificial git worktree at `../<repo-name>-codex-worktree` for codex-writer to write into safely. Create it once:

```bash
REPO_NAME=$(basename "$(pwd)")
git worktree add "../${REPO_NAME}-codex-worktree" -b codex-writer-isolated
```

If the worktree already exists, skip. Verify with:

```bash
git worktree list
```

You should see two entries: the main worktree and `<repo-name>-codex-worktree` on `codex-writer-isolated`.

### 3. Verify hooks load

Tell the user to run `/hooks` in the Claude Code prompt. Expected output: four hook entries — `UserPromptSubmit`, `PreToolUse Write|Edit`, `PreCompact manual|auto`, `SessionStart clear|compact`. If any are missing, check `.claude/settings.json`.

### 4. Verify Codex and Gemini reachable

Codex companion script discovery:

```bash
printf '%s\n' "$HOME"/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs 2>/dev/null | sort -V | tail -1
```

If this prints a path, Codex is installed. If it's empty, the user needs to install the openai-codex Claude Code plugin.

Gemini CLI:

```bash
command -v gemini && gemini --version
```

If `gemini` is not on PATH, the user needs to install the Gemini CLI.

### 5. Optional — recommend permissions

If the user wants to skip per-tool-call approval prompts for the routine Codex / Gemini Bash invocations, suggest copying `.claude/settings.local.json.example` to `.claude/settings.local.json` (which is git-ignored) and reviewing the permissions block.

## Done

Report status to the user as a four-line table:

```
[ok]   initial commit
[ok]   codex worktree at ../<repo-name>-codex-worktree
[ok]   hooks loaded (4)
[ok]   codex + gemini reachable
```

Or `[FAIL]` with the failure reason. Do not proceed to Phase 0 until all four are `[ok]`.

## Anti-patterns

- Do NOT run `git worktree add` if the worktree already exists — it errors and confuses the user.
- Do NOT amend the scaffold commit; create a new commit if there's anything to fix.
- Do NOT pre-emptively dispatch any subagent here — bootstrap is local repo setup only.
