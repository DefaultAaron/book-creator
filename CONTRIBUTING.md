# Contributing to book-creator

Thanks for your interest in improving the scaffold. This is a small project; the contribution process is intentionally light.

## What this repo is

A topic-and-genre-agnostic scaffold for using Claude Code to draft long-form books through a five-actor agent team and a seven-phase pipeline. The scaffold itself is mostly Markdown, JSON, JavaScript, and Bash. **No build system, no test suite** — changes are reviewed by reading.

## Where to make changes

| You want to change... | Edit... |
|---|---|
| The pipeline procedure (phases, gates, convergence rules) | `_workflow/pipeline_design.md` (verbose authoritative spec), then update `CLAUDE.md` (concise summary) and `README.md` to match |
| Agent behavior (cc-writer, codex-writer, codex-collaborator, gemini-researcher) | `.claude/agents/<agent>.md` |
| Hook behavior (path scope, snapshot, reminders) | `.claude/hooks/<hook>.{mjs,sh}` |
| Skill content (bootstrap, new-book, new-chapter, draft-batch, section-deal-loop, close-chapter) | `.claude/skills/<skill>/SKILL.md` |
| Templates (section, chapter overview, chapter plan, book outline, section brief) | `_templates/<template>.md` |
| Hook wiring | `.claude/settings.json` |

## The lockstep rule

The pipeline is documented in three places at three levels of detail:

1. `_workflow/pipeline_design.md` — verbose authoritative spec
2. `CLAUDE.md` — concise summary always in Claude's context
3. `README.md` — public-facing overview

**If you change a load-bearing rule (a phase boundary, a convergence protocol, a path-scoping layer), update all three together.** The "modification discipline" section in `CLAUDE.md` makes this load-bearing for users; it's also load-bearing for contributors.

## Testing changes

There is no automated test suite. Before opening a PR, verify by hand:

```bash
# Hooks parse cleanly
node --check .claude/hooks/check_writer_path_scope.mjs
node --check .claude/hooks/snapshot_state.mjs
bash -n .claude/hooks/codex_conflict_reminder.sh
bash -n .claude/hooks/state_recovery_reminder.sh

# Settings JSON is valid
node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'))"

# Snapshot hook runs without error against an empty STATE.md
node .claude/hooks/snapshot_state.mjs
```

For agent / skill / template content changes, the only test is reading the diff carefully and trying it in a real Claude Code session.

## Pull request guidelines

- One concern per PR. Don't bundle agent rewrites with hook changes.
- Open an issue first for substantial pipeline changes (anything that affects phase structure, convergence protocol, or the four-layer path scoping). The pipeline's invariants are subtle and small wording changes can have outsized effects.
- For typo / wording / docs fixes, just open the PR.

## Reporting issues

When reporting a workflow bug, include:

- Which skill or phase you were running
- The relevant `STATE.md` reasoning fields
- The last few `git log --oneline` entries (commit prefix taxonomy gives useful context)
- Whether the codex worktree was clean / ff'd
- Whether `.claude/active_writer_batch.json` existed at the time

## Code of conduct

Be kind. The scaffold's pipeline rules are deliberately strict; conversation about them doesn't need to be.
