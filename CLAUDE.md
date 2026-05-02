# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when operating in this repository.

## Repository type

This is the **book-creator scaffold** — a topic-and-genre-agnostic pipeline that takes a user-defined topic and produces a long-form book through a five-actor team running a seven-phase workflow (Phase 0 derives the book outline; Phases 1–6 run per chapter).

Treat new section files as long-form prose for the user, not source code. Treat workflow files (`_workflow/`, `.claude/`, `_templates/`) as the pipeline's machinery.

## Pipeline summary

Verbose authoritative spec: `_workflow/pipeline_design.md`. This section is the concise summary that always loads into your context.

**Agent team (5 actors):**

- **Main session** — Claude Code (this CLI). Orchestrator + **conflictor for codex-drafted sections** (Phase 5 Path B rounds 1..N-1) + sole authority for `CLAUDE.md`, `README.md`, top-level meta files, TOC, chapter overviews, final commits.
- **`codex-collaborator`** — codex-companion runtime, no `--write`. Dual-mode RESEARCH | CONFLICT. Conflictor for **cc-drafted sections every round** (Phase 5 Path A); **final-round sanity pass on codex-drafted sections** (Phase 5 Path B round N + any re-pass triggered by fixes). Pass `RESUME: true` to continue a critique thread with `--resume-last`.
- **`gemini-researcher`** — Gemini CLI, `--approval-mode plan`. Research only; never critique, never drafting. Also performs **content-risk-triggered** factual spot-checks for codex-drafted sections (Rule 3b — rerun on factual changes).
- **`cc-writer`** — Claude Code subagent. Drafts AND revises one section file per dispatch into the main repo. Path scope is hard-enforced by the `PreToolUse` hook (`.claude/hooks/check_writer_path_scope.mjs`) reading `.claude/active_writer_batch.json`.
- **`codex-writer`** — codex-companion runtime, `--write` enabled, `--cwd` set to the sacrificial worktree at `../<repo-name>-codex-worktree`. Drafts AND revises one section file per dispatch inside the worktree; main session copies the assigned path back to the main repo after the writer returns.

**Pipeline (7 phases — Phase 0 once, Phases 1–6 per chapter):**

0. **Book outline derivation** — Main + gemini + codex RESEARCH parallel research on the user's topic; main drafts an outline at `_workflow/plans/book_outline.md`; codex CONFLICT iterates to AGREED; **user explicitly approves**; main writes `00_table_of_contents.md` + per-chapter overview shells; single `outline:` commit.
1. **Research** (per chapter) — main + gemini + codex RESEARCH in parallel; main integrates into `_workflow/research/<chapter>_synthesis.md`.
2. **Research deal-loop** — main + codex CONFLICT iterate; codex may *propose* structural changes (proposed-not-adopted; user approves before lockstep update).
3. **Chapter plan + allocation deal-loop** — main drafts chapter plan covering: section list, DAG, parallel batches, writer assignments, handoff snippets, style anchor, prerequisite chain, TOC slice, must-preserve terminology, reader assumptions, downstream commitments. Codex CONFLICT reviews. **Writer assignment is finalized here and locked for the chapter** — no mid-run fallback.
4. **Per-section drafting** (parallel where independent) — main builds section briefs at `_workflow/briefs/`, enforces full-repo `git status --porcelain` clean precondition, writes the batch sentinel listing assigned paths, dispatches cc-writer / codex-writer per the **codex-default ratio** (cc-writer reserved for chapter-classified contested-framing / high-judgment-synthesis sections per Rule 3a), copies codex-writer outputs back from the worktree, runs structured post-batch validation, removes the sentinel.
5. **Per-section deal-loop** — **asymmetric by writer model**:
   - **Path A (cc-drafted)** — main + codex-collaborator CONFLICT iterate every round under bidirectional convergence. Both must AGREE.
   - **Path B (codex-drafted)** — main session conflicts rounds 1..N-1 unilaterally; codex-collaborator does a **final-round sanity pass** at round N. Any fix to a codex-collaborator final-round critique requires another codex-collaborator pass on the changed text.
   - Path B main-conflict review must explicitly check the four named bias axes: **markdown over-listing**, **analogy register**, **foundational example choice**, **depth defaults**.
   - Codex-drafted sections also require gemini factual spot-check on 2–3 claims **on content-risk trigger** (Rule 3b).
   - **Revisions go through writer dispatch — drafts AND revisions.** Main session direct-edits section content only via `main-direct: writer-overhead` (narrow: spelling, duplicated word, broken Markdown, format artifact — no semantic changes).
   - Round 4+ codex-drafted residual editorial disagreement may dispatch a **cc-writer fresh-eye revision** on the disputed passage (Rule 3d). Same passage + same unresolved defect + same requested outcome across rounds, with persistent critique IDs.
6. **Chapter voice pass (terminal)** — main + codex harmonize **surface concerns only** (transitions, pacing, redundancy, terminology drift). No structural rewrites — kicks back to Phase 5. On AGREED, main sets every section's `workflow_status: complete` and commits.

**Convergence protocol** — every CONFLICT-mode codex response ends with `STILL DISAGREEING: <one-line>` (loop continues) or `AGREED: <one-line>` (phase complete; or final-round pass complete on Path B). **Main session may push back** when a critique is wrong, off-target, or out of scope: `CONTESTED: <critique-id> — <rationale-category>: <one-line>` where rationale-category ∈ {`already-satisfied`, `technically-wrong`, `pedagogically-worse`, `out-of-scope`, `over-budget`, `chapter-context`}. Codex's next round must answer the contested rationale before introducing new objections. **`CONTESTED:` applies in Path A every round, in Path B only at the final round and beyond, and in Phases 0 / 2 / 3 / 6 every round.** Trivial / docs-only / single-sentence edits skip the deal-loop.

**Section file lifecycle:** one file per section, `chapter_<N>_<slug>/<N>_<M>_<section_slug>.md`. Frontmatter `workflow_status: planned → draft → reviewing → complete` is kept indefinitely (no stripping at completion).

**Git commit strategy (Strategy C+):** WIP commits on every writer return AND milestone commits at every AGREED gate. Default no squash. Seven-prefix taxonomy: `outline / wip / revert / agreed / plan / chapter / lockstep`. See `_workflow/pipeline_design.md` §7.

## Modification discipline (load-bearing)

- **Never apply a modification before codex `AGREED`** at the relevant phase. Direct user instructions that change the agreed plan still go through the deal loop first. The rule applies to workflow / meta-architecture changes, not just book content.
- **Never act on downstream artifacts before the user explicitly approves the plan.** "Give me the plan" means present-then-wait, not implement.
- **When you do change anything substantive, update `CLAUDE.md` + `README.md` + `_workflow/pipeline_design.md` + `00_table_of_contents.md` + affected chapter overviews together** so the sources never drift.

A `UserPromptSubmit` hook at `.claude/hooks/codex_conflict_reminder.sh` injects a reminder of this discipline on every prompt. The hook is a reminder, not enforcement — the discipline still lives in the rule above.

## Live workflow state — `_workflow/STATE.md`

A fast-recovery snapshot of where the book is in the pipeline (active phase, active batch, next action, open CONFLICT threads, do-not-redo notes). **NOT a source of truth** — verify against `git log` and section frontmatter before acting. Mechanical fields are auto-refreshed by the `PreCompact` hook (`.claude/hooks/snapshot_state.mjs`); reasoning fields are updated by main session at each AGREED commit, each WIP commit, and at session end. A `SessionStart` hook (matchers `clear` + `compact`) emits a one-line reminder to read STATE.md after context loss.

## Project-level skills (`.claude/skills/`)

The pipeline procedure is encoded as six invocable skills. Use the `Skill` tool to invoke. Each skill maps to a workflow boundary; invoke the one that matches what the user just asked for.

| Skill | When to use | Phases |
|---|---|---|
| `bootstrap` | Fresh scaffold, no commits / no codex worktree, or user asks "set things up" | One-time setup |
| `new-book` | User gives a topic and there is no `_workflow/plans/book_outline.md` | Phase 0 |
| `new-chapter` | User starts a new chapter; no `_workflow/plans/<chapter>_chapter_plan.md` | Phases 1–3 |
| `draft-batch` | Chapter plan AGREED, next batch in DAG ready to dispatch | Phase 4 |
| `section-deal-loop` | A section is at `workflow_status: draft` or `reviewing` and needs critique iteration | Phase 5 |
| `close-chapter` | Every section in chapter at `workflow_status: reviewing` (Phase 5 AGREED) | Phase 6 |

Skills are procedural checklists; the verbose spec (`_workflow/pipeline_design.md`) is the why. When in doubt, the skill's body links back to the relevant spec section.

## Working in the repo

- Section files live at `chapter_<N>_<slug>/<N>_<M>_<section_slug>.md`. Underscore-prefixed folders (`_workflow/`, `_templates/`, `_assets/`) are support, not content.
- Templates are in `_templates/`. Use `_section.md` for new section files; `_chapter_overview.md` for chapter overviews; `_chapter_plan.md` for Phase 3 plans; `_book_outline.md` for Phase 0; `_section_brief.md` for Phase 4 writer briefs.
- All hooks live in `.claude/hooks/` and are wired in `.claude/settings.json`. After editing a hook, run `/hooks` to verify Claude Code picked up the change.
- The codex-writer worktree must be initialized once per book project: `git worktree add ../$(basename "$(pwd)")-codex-worktree -b codex-writer-isolated`. The `bootstrap` skill does this for you.

## Optional plugins

The scaffold does not require any plugin to function. None is shipped in this repo. General install pattern:

```
/plugin marketplace add <github-owner>/<github-repo>
/plugin install <plugin-name>@<marketplace-name>
/reload-plugins
```

**Project-enableable** (also requires entry in `.claude/settings.local.json` `enabledPlugins`, per-machine, git-ignored):

- **`obsidian@obsidian-skills`** — adds `obsidian:obsidian-markdown`, `obsidian:obsidian-cli`, `obsidian:json-canvas`, `obsidian:obsidian-bases`, `obsidian:defuddle`. Useful when authoring inside an Obsidian vault.
  ```
  /plugin marketplace add kepano/obsidian-skills
  /plugin install obsidian@obsidian-skills
  /reload-plugins
  ```

**User-level** (installed globally at `~/.claude/`; not project-enableable):

- **`superpowers@claude-plugins-official`** — generic Claude Code skill collection. Pipeline-relevant skills: `superpowers:brainstorming` (Phase 0), `superpowers:dispatching-parallel-agents` (Phases 1 & 4), `superpowers:verification-before-completion` (every AGREED gate), `superpowers:receiving-code-review` (Phase 5).
  ```
  /plugin marketplace add anthropics/claude-plugins-official
  /plugin install superpowers@claude-plugins-official
  /reload-plugins
  ```

A starter for the project-enableable settings is checked in at `.claude/settings.local.json.example`. Copy to `.claude/settings.local.json` and edit. The same file is the right place to pre-allow the routine Codex / Gemini Bash invocations to skip per-dispatch approval prompts.

## Topic-and-genre neutrality

The pipeline is intentionally generic. Topic-specific decisions (genre, audience, depth, style anchors, terminology) are made at Phase 0 (book outline) and refined per chapter at Phase 3. Do not bake topic-specific assumptions into `CLAUDE.md`, `README.md`, or `_workflow/pipeline_design.md` — they belong in `_workflow/plans/book_outline.md` and per-chapter plans.
