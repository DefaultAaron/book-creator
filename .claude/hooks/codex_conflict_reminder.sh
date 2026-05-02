#!/usr/bin/env bash
# UserPromptSubmit hook — reminds the model of the codex CONFLICT discipline.
# Output is added to the model's prompt context. Stays terse.

cat <<'EOF'
[discipline reminder] For any non-trivial design / plan / draft change in this repo, the FIRST action is to dispatch codex-collaborator (MODE: CONFLICT) and reach AGREED before applying changes. See `CLAUDE.md` "Pipeline summary" + `_workflow/pipeline_design.md` §3 / §8. Trivial / docs-only / single-sentence edits skip the deal-loop.
EOF
