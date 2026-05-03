#!/usr/bin/env bash
# UserPromptSubmit hook — reminds the model of the codex CONFLICT discipline.
# Output is added to the model's prompt context. Stays terse.

cat <<'EOF'
[discipline reminder] In this repo, no substantive plan / draft change is *finalized* or *committed* until codex-collaborator (MODE: CONFLICT) has reached AGREED. The deal-loop runs *after* main session has produced something reviewable (an outline at Phase 0; a chapter plan at Phase 3; a draft at Phase 5; etc.) — not before. See `CLAUDE.md` "Pipeline summary" + `_workflow/pipeline_design.md` §3 / §8. Trivial / docs-only / single-sentence edits skip the deal-loop.
EOF
