# book-creator

> Turn a topic into a long-form book with [Claude Code](https://claude.com/claude-code) — through a five-actor agent team, a seven-phase pipeline, and adversarial cross-model review.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Built for Claude Code](https://img.shields.io/badge/built%20for-Claude%20Code-orange.svg)](https://claude.com/claude-code)

`book-creator` is a topic-and-genre-agnostic scaffold for writing long-form books with AI agents. You give Claude Code a topic; the pipeline produces an outlined, drafted, and voice-passed book under adversarial AGREED gates between two writer subagents (one Claude, one Codex), one critique subagent, and one research subagent.

The design is opinionated about three things:

- **No section is signed off by the model that wrote it.** Cross-model adversarial review is the default — main session critiques codex-drafts, codex-collaborator critiques cc-drafts, and Gemini factually spot-checks codex-drafts.
- **Drafting is parallel where the dependency DAG allows.** Independent sections in the same chapter draft simultaneously through different writers.
- **Every writer return is a commit.** Strategy C+ git taxonomy keeps a full WIP audit trail with cleanly filterable milestones.

---

## Table of contents

- [Why?](#why)
- [How it works](#how-it-works)
- [Quick start](#quick-start)
- [Repo layout](#repo-layout)
- [The 5 actors](#the-5-actors)
- [The 7 phases](#the-7-phases)
- [Project-level skills](#project-level-skills)
- [Hooks](#hooks)
- [Path scoping & safety](#path-scoping--safety)
- [Customization](#customization)
- [Optional plugins](#optional-plugins)
- [Prior art](#prior-art)
- [Contributing](#contributing)
- [License](#license)

---

## Why?

Drafting a long book through one model session alone has four failure modes:

1. **Single quota** — one model's quota exhaustion halts the project.
2. **Context bloat** — long drafts crowd out the reasoning needed to critique them.
3. **No durable artifact** — a session crash mid-draft loses the in-flight prose.
4. **Same-model bias** — one model's stylistic and factual blind spots ship to the reader unchecked.

`book-creator` distributes drafting across two writer agents (Claude Code and Codex) running in parallel where dependencies allow, holds critique authority centrally with main-session + Codex CONFLICT, and breaks same-model bias structurally: main critiques codex-drafts, codex critiques cc-drafts, Gemini factually spot-checks codex-drafts. Every writer return is a `wip(...)` commit, so a session crash loses at most one in-flight section.

---

## How it works

```
                 ┌────────────────────────────────────────────────────────┐
   Topic ──────► │ Phase 0: Outline derivation (parallel research →       │
                 │          codex CONFLICT → user approval → TOC + shells)│
                 └────────────────────────────────────────────────────────┘
                                          │
                                          ▼
                 ┌────────────────────────────────────────────────────────┐
                 │ For each chapter, in canonical order:                  │
                 │   Phase 1: Parallel research                           │
                 │   Phase 2: Research deal-loop  ─────┐                  │
                 │   Phase 3: Chapter plan + allocation│ codex CONFLICT   │
                 │   Phase 4: Per-section drafting     │ until AGREED     │
                 │            (parallel where independent)                │
                 │   Phase 5: Per-section deal-loop ───┘                  │
                 │            (asymmetric by writer model)                │
                 │   Phase 6: Chapter voice pass (terminal)               │
                 └────────────────────────────────────────────────────────┘
                                          │
                                          ▼
                                       Book
```

Five actors collaborate:

- **Main session** (Claude Code) — orchestrator + conflictor for codex-drafts.
- **`codex-collaborator`** — read-only Codex; researcher and adversarial reviewer.
- **`gemini-researcher`** — read-only Gemini; researcher and factual spot-checker.
- **`cc-writer`** — Claude Code subagent; drafts and revises one section per dispatch.
- **`codex-writer`** — Codex with `--write`, isolated to a sacrificial git worktree.

Verbose authoritative spec: [`_workflow/pipeline_design.md`](_workflow/pipeline_design.md).

---

## Quick start

### Prerequisites

- [Claude Code](https://claude.com/claude-code) installed and authenticated.
- The OpenAI Codex Claude Code plugin (provides `codex-companion.mjs`).
- The Gemini CLI (`gemini`) installed and authenticated.
- Node.js 18+ (for the hook scripts) and Bash (for the reminder hooks).
- Git 2.5+ (for `git worktree`).

### One-time setup

```bash
# 1. Clone or copy this scaffold (rename the directory to your project's name).
git clone https://github.com/<your-fork>/book-creator.git my-book
cd my-book

# 2. Make it your own repo (skip if you want to keep the upstream history).
rm -rf .git && git init

# 3. (Optional) override defaults BEFORE invoking bootstrap, so they take effect:
#    export BOOK_CREATOR_CODEX_WORKTREE=/abs/path/to/somewhere-codex-worktree
#    export BOOK_CREATOR_GEMINI_MODEL=gemini-3.1-pro-preview

# 4. (Optional) opt into pre-approved Bash permissions and Obsidian skills:
cp .claude/settings.local.json.example .claude/settings.local.json
# ...edit to taste; the file is git-ignored
```

Now open Claude Code in the repo and let `bootstrap` finish the setup — it makes the initial commit, detects the default branch, creates the codex worktree, smoke-tests Codex `--cwd` isolation, and verifies hooks + Gemini reachability:

```
> /bootstrap
```

(Or just say "set things up" / "is everything wired" — the skill auto-invokes on those phrases.) Do NOT skip bootstrap and start Phase 0 manually; the `--cwd` smoke-test catches misconfigurations that would otherwise corrupt the main repo on a Phase-4 codex-writer dispatch.

### Then give it a topic

```
> A book about reservoir sampling for engineers — 200 pages, conversational register,
  English, assumes basic probability. Start with Phase 0.
```

The `new-book` skill runs Phase 0 (parallel research → outline draft → codex CONFLICT loop → presents to you for approval). Once you approve, `new-chapter` runs Phases 1–3 for the first chapter, `draft-batch` dispatches writers for each batch in the DAG, `section-deal-loop` iterates each section to AGREED, and `close-chapter` publishes when every section in the chapter has reached AGREED.

You can interrupt, redirect, or push back at any AGREED gate.

---

## Repo layout

```
book-creator/
├── README.md                                   ← this file
├── CLAUDE.md                                   ← concise pipeline summary (always in Claude's context)
├── CONTRIBUTING.md
├── LICENSE
├── _workflow/
│   ├── pipeline_design.md                      ← verbose authoritative spec
│   ├── STATE.md                                ← live workflow state snapshot
│   ├── briefs/                                 ← per-section writer briefs (Phase 4)
│   ├── plans/                                  ← book outline + per-chapter plans (Phase 0 + 3)
│   └── research/                               ← per-chapter research syntheses (Phase 1)
├── _templates/
│   ├── _book_outline.md                        ← Phase 0 deliverable template
│   ├── _chapter_plan.md                        ← Phase 3 deliverable template
│   ├── _chapter_overview.md                    ← per-chapter overview shell
│   ├── _section.md                             ← section file starter
│   ├── _section_brief.md                       ← Phase 4 writer brief template
│   ├── _code_example.md                        ← optional, for code-heavy books
│   └── _reading_list_entry.md                  ← optional, for non-fiction / research books
├── _assets/                                    ← optional support folder; figures/ and code/ are reserved subdirs
│   ├── code/                                   ← externalised long code excerpts (referenced from sections)
│   └── figures/                                ← diagrams / images embedded by sections
├── 00_table_of_contents.md                     ← (created at Phase 0) live progress tracker
├── chapter_0_<slug>/                           ← (created at Phase 0) one folder per chapter
│   ├── 0_0_overview.md                         ← chapter overview
│   ├── 0_1_<section_slug>.md                   ← section files (status: planned → draft → reviewing → complete)
│   └── ...
└── .claude/
    ├── agents/                                 ← cc-writer · codex-writer · codex-collaborator · gemini-researcher
    ├── hooks/                                  ← path-scope guard · STATE.md snapshot · session reminders
    ├── skills/                                 ← bootstrap · new-book · new-chapter · draft-batch · section-deal-loop · close-chapter
    ├── settings.json                           ← hook wiring (committed)
    └── settings.local.json.example             ← per-machine settings template (real one is git-ignored)
```

Underscore-prefixed top-level folders (`_workflow/`, `_templates/`, `_assets/`) are pipeline support, not book content.

---

## The 5 actors

| Role | Runtime | Writes? | Job |
|---|---|---|---|
| **Main session** | Claude Code (you) | yes — meta files (`CLAUDE.md`, `README.md`, TOC, chapter overviews), section frontmatter flips on Phase-5/6 AGREED, and `main-direct: writer-overhead` edits to section content (rare) | Orchestrator + conflictor for codex-drafts (Phase 5 Path B rounds 1..N-1) |
| **`codex-collaborator`** | codex-companion, no `--write` | no | Dual-mode `RESEARCH \| CONFLICT`. Conflictor for cc-drafts every round; final-round sanity pass on codex-drafts |
| **`gemini-researcher`** | Gemini CLI, `--approval-mode plan` | no | Research only + content-risk-triggered factual spot-check |
| **`cc-writer`** | Claude Code subagent (Read/Write/Edit, no Bash) | yes — only the batch-assigned section path, hook-enforced | Drafts AND revises one section file per dispatch in the main repo |
| **`codex-writer`** | codex-companion `--write`, `--cwd` to sacrificial worktree | inside the worktree only | Drafts AND revises one section file per dispatch; main copies the assigned path back |

Codex appears in two distinct subagent files (`-collaborator` and `-writer`). Different invocations, no shared state. The cross-model adversarial pattern (main on codex-drafts; codex on cc-drafts; Gemini factual spot-check on codex-drafts) is the primary same-model bias break.

---

## The 7 phases

**Phase 0 — Book outline derivation.** Main + Gemini + Codex RESEARCH parallel research on the topic. Main integrates into `_workflow/plans/book_outline.md`. Codex CONFLICT iterates to AGREED. **User explicitly approves.** On approval, main writes `00_table_of_contents.md` + per-chapter overview shells. Single `outline:` commit. Phase 0 is the only phase where user approval is mandatory.

**Phase 1 — Research (per chapter).** Main + Gemini + Codex RESEARCH parallel research. Main integrates into `_workflow/research/<N>_<chapter_slug>_synthesis.md` (canonical: same `<N>_<chapter_slug>` stem as the chapter folder).

**Phase 2 — Research deal-loop.** Main ↔ codex-collaborator CONFLICT iterate. Codex may *propose* structural changes (proposed-not-adopted; user approval required for adoption + lockstep update).

**Phase 3 — Chapter plan + allocation.** Main drafts a chapter plan covering 11 recommended items (section list, DAG, parallel batches, writer assignments, handoff snippets, style anchor, prerequisite chain, TOC slice, must-preserve terminology, reader assumptions, downstream commitments). Codex CONFLICT reviews. **Writer allocation is locked at AGREED — no mid-run fallback.**

**Phase 4 — Per-section drafting (parallel where independent).** For each batch of independent sections in the DAG: main enforces full-repo clean precondition → builds briefs → commits briefs → ffs the codex worktree → captures pre-batch SHA → writes batch sentinel → dispatches writers (cc-writers parallel; codex-writers serialized within the batch because they share the worktree) → copies codex-writer outputs back from worktree → runs structured post-batch validation → commits drafts → resets the codex worktree → removes sentinel.

**Phase 5 — Per-section deal-loop (asymmetric by writer model).**
- **Path A (cc-drafted)** — bidirectional. Main ↔ codex-collaborator CONFLICT every round. Both must AGREE.
- **Path B (codex-drafted)** — main conflicts rounds 1..N-1 unilaterally (must enumerate four named bias axes: markdown over-listing / analogy register / foundational example / depth). Codex-collaborator does a final-round sanity pass at round N. Any fix triggers another codex-collaborator pass.
- Codex-drafts get Gemini factual spot-check on 2–3 claims **on content-risk trigger** (rerun on factual changes, not per round).
- **Revisions go through writer dispatch** (one-section sentinel). Only `main-direct: writer-overhead` (typos / broken Markdown / format artifacts — no semantic changes) is allowed for direct main edits.

**Phase 6 — Chapter voice pass (terminal).** Main + codex-collaborator harmonize **surface concerns only**. No structural rewrites — those bounce back to Phase 5. On AGREED, every section's `workflow_status` flips to `complete` and one `chapter(<N>):` commit publishes the chapter with TOC + chapter-overview lockstep updates.

### Convergence protocol

Every codex-collaborator CONFLICT response ends with exactly one of:
- `STILL DISAGREEING: <one-line>` → main dispatches round N+1 with `RESUME: true`.
- `AGREED: <one-line>` → phase complete (Path A every round; Path B final round only).

Main session may push back via:
```
CONTESTED: <critique-id> — <rationale-category>: <one-line>
```

Allowed rationale categories (closed list): `already-satisfied`, `technically-wrong`, `pedagogically-worse`, `out-of-scope`, `over-budget`, `chapter-context`. Codex's next round must answer the contested rationale before introducing new objections.

---

## Project-level skills

The pipeline procedure is encoded as six [Claude Code skills](https://docs.claude.com/en/docs/claude-code/skills) under `.claude/skills/`. Claude invokes the right skill automatically based on the user's request.

| Skill | When | Phase |
|---|---|---|
| [`bootstrap`](.claude/skills/bootstrap/SKILL.md) | Fresh scaffold; one-time setup | — |
| [`new-book`](.claude/skills/new-book/SKILL.md) | User gives a topic | Phase 0 |
| [`new-chapter`](.claude/skills/new-chapter/SKILL.md) | Start a new chapter | Phases 1–3 |
| [`draft-batch`](.claude/skills/draft-batch/SKILL.md) | Dispatch writers for a batch | Phase 4 |
| [`section-deal-loop`](.claude/skills/section-deal-loop/SKILL.md) | Iterate one section to AGREED | Phase 5 |
| [`close-chapter`](.claude/skills/close-chapter/SKILL.md) | Publish a chapter | Phase 6 |

Each skill is a procedural checklist — links back to the verbose spec for the why.

---

## Hooks

`.claude/settings.json` wires four hooks:

| Event | Matcher | Script | Job |
|---|---|---|---|
| `UserPromptSubmit` | (any) | [`codex_conflict_reminder.sh`](.claude/hooks/codex_conflict_reminder.sh) | Inject one-line reminder of the codex CONFLICT discipline before each user prompt |
| `PreToolUse` | `Write\|Edit` | [`check_writer_path_scope.mjs`](.claude/hooks/check_writer_path_scope.mjs) | Block writes outside the active batch sentinel's allowlist; permissive when no sentinel |
| `PreCompact` | `manual\|auto` | [`snapshot_state.mjs`](.claude/hooks/snapshot_state.mjs) | Refresh mechanical fields in `_workflow/STATE.md` before context compaction |
| `SessionStart` | `clear\|compact` | [`state_recovery_reminder.sh`](.claude/hooks/state_recovery_reminder.sh) | Print one-line reminder to read `_workflow/STATE.md` for fast recovery |

After editing any hook, run `/hooks` in Claude Code to verify the new entries are visible.

---

## Path scoping & safety

Four independent layers protect the repo from runaway writers:

1. **Full-repo clean-state precondition** — main session aborts a writer batch if `git status --porcelain` is non-empty anywhere in the repo. User must commit/stash before drafting.
2. **cc-writer hard guard via PreToolUse hook** — `check_writer_path_scope.mjs` reads `.claude/active_writer_batch.json` and blocks Write/Edit calls outside the batch's assigned-paths allowlist. Permissive when no sentinel exists.
3. **codex-writer hard isolation** — Codex always runs with `--cwd "$WORKTREE"` (a sacrificial git worktree on a long-lived branch; default `../<repo-name>-codex-worktree`, override via `BOOK_CREATOR_CODEX_WORKTREE`). Only the assigned section path is copied back to main. The worktree's `reset --hard` is destructive *only inside the worktree*, never main. Bootstrap includes a smoke-test that verifies `--cwd` isolation works on the user's Codex install before the first batch.
4. **Structured post-batch validation** — main computes the change set against the batch sentinel and reverts out-of-scope events file-by-file (never blanket `git restore .`).

Combined, the four layers make every writer dispatch reversible up to single-section granularity.

---

## Customization

The pipeline is topic-and-genre-agnostic. Project-specific decisions are made at Phase 0 (book outline) or per chapter at Phase 3 (chapter plan), not in this scaffold's source.

| Customization | Where |
|---|---|
| Genre (pedagogical / reference / narrative / hybrid) | `_workflow/plans/book_outline.md` §1 |
| Target audience, language(s), length budget | `_workflow/plans/book_outline.md` §1 |
| Style anchor, voice rules, register, depth defaults | `_workflow/plans/book_outline.md` §4 + per-chapter plan §6 |
| Cross-cutting threads (terminology, motifs) | `_workflow/plans/book_outline.md` §3 + per-chapter plan §9 |
| Bilingual / multilingual file naming | Extend section file naming to `<N>_<M>_<section_slug>_<LANG>.md`; document in book outline §1 |
| Code-example / asset / figure conventions | Use `_templates/_code_example.md` and the `_assets/code/` + `_assets/figures/` folders. Document the convention in book outline §4 if you want to lock it. |
| Reading list / bibliography | Use `_templates/_reading_list_entry.md` and create `reading_list.md` at repo root for non-fiction / research books. Optional. |
| Codex model | Edit `.claude/agents/codex-{collaborator,writer}.md`; current default is `gpt-5.5` |
| Gemini model | Set `BOOK_CREATOR_GEMINI_MODEL=<model-id>` in your shell profile; default is `gemini-3.1-pro-preview`. Override is required if the preview model has been retired by the time you run the scaffold. |
| Codex worktree location | Default `../<repo>-codex-worktree`; override with `BOOK_CREATOR_CODEX_WORKTREE=<absolute-path>` in your shell profile (read by bootstrap, draft-batch, snapshot hook, codex-writer). |
| Worktree branch name | `codex-writer-isolated` by default — change in agent file + `git worktree add` if you prefer |

---

## Optional plugins

The scaffold does not require any Claude Code plugin to function. The following are commonly useful but optional. None is shipped in this repo — install them yourself with the commands below.

Both plugins use Claude Code's plugin system. The general pattern is:

```
/plugin marketplace add <github-owner>/<github-repo>     # one-time per marketplace
/plugin install <plugin-name>@<marketplace-name>          # install a plugin from it
/reload-plugins                                           # activate in the current session (no restart needed)
```

### `obsidian@obsidian-skills` — Obsidian authoring helpers

Project-enableable. Useful when you author your book inside an Obsidian vault.

**Skills added:** `obsidian:obsidian-markdown` (Obsidian Flavored Markdown — wikilinks, callouts, embeds), `obsidian:obsidian-cli` (vault CLI manipulation: search, list, open notes), `obsidian:json-canvas` (`.canvas` files), `obsidian:obsidian-bases` (`.base` files), `obsidian:defuddle` (clean-Markdown extraction from URLs).

**Install:**

```
/plugin marketplace add kepano/obsidian-skills
/plugin install obsidian@obsidian-skills
/reload-plugins
```

**Enable per project:** add to your per-machine `.claude/settings.local.json` (git-ignored):

```json
{
  "enabledPlugins": {
    "obsidian@obsidian-skills": true
  }
}
```

A starter is checked in at [`.claude/settings.local.json.example`](.claude/settings.local.json.example) — copy to `.claude/settings.local.json` and edit.

### `superpowers@claude-plugins-official` — generic Claude Code skill collection

Installed at user level (`~/.claude/plugins/...`); not project-enableable. Either you have it installed globally or you don't.

**Skills relevant to book-creator's pipeline:**
- `superpowers:brainstorming` — complements **Phase 0** topic intake (open-ended exploration before the outline takes shape).
- `superpowers:dispatching-parallel-agents` — mirrors the discipline in **Phases 1 & 4** (parallel research streams; parallel writer batches).
- `superpowers:verification-before-completion` — reinforces every AGREED gate; useful for keeping main session honest before declaring `agreed(...)` or `chapter(...)`.
- `superpowers:receiving-code-review` — translates well to **Phase 5**; main session is the recipient of codex-collaborator's CONFLICT critique on cc-drafted sections.

**Install:**

```
/plugin marketplace add anthropics/claude-plugins-official
/plugin install superpowers@claude-plugins-official
/reload-plugins
```

(There is also a community marketplace at `obra/superpowers-marketplace` — either source works. The official Anthropic marketplace is canonical.)

### Bash permissions starter

`.claude/settings.local.json.example` is also the right place to pre-allow the routine Codex / Gemini Bash invocations so Claude Code doesn't prompt for approval on every dispatch. Copy it to `.claude/settings.local.json`, replace the placeholder username, and edit to taste.

---

## Prior art

This scaffold is the abstracted, topic-agnostic version of a pipeline first built and run end-to-end inside an Obsidian vault to produce a long-form book on autonomous driving. The original embedded specific topic, language (bilingual EN/ZH), authoring environment (Obsidian), and outline (13 chapters) into the workflow files. This repo extracts the workflow itself and removes those topic-specific assumptions, so the same pipeline can be pointed at any topic.

The seven-phase / five-actor structure, the asymmetric Phase 5 Path A / Path B, the `CONTESTED:` rationale-category protocol, the four-layer path scoping, and the Strategy C+ git taxonomy all originate in that source project. Empirical iteration there shaped the rules; this repo packages them.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Briefly: the pipeline's invariants are subtle — open an issue first for substantial changes, and remember the lockstep rule (changes to load-bearing rules update `_workflow/pipeline_design.md` + `CLAUDE.md` + `README.md` together).

## License

[MIT](LICENSE).
