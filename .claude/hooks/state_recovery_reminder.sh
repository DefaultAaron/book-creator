#!/usr/bin/env bash
# SessionStart hook (matchers: clear, compact).
# Reminds the model to read `_workflow/STATE.md` for fast recovery after
# context loss. Output goes to stdout, which Claude Code injects as session
# context.
echo "[state-recovery] Read \`_workflow/STATE.md\` for the fast-recovery snapshot of the book-creator workflow state. NOT a source of truth — verify against \`git log\` and section-file frontmatter before acting."
exit 0
