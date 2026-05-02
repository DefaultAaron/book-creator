#!/usr/bin/env node
// PreCompact hook for `_workflow/STATE.md` mechanical refresh.
//
// Refreshes ONLY mechanical git facts in STATE.md before context compaction:
//   - frontmatter: last_updated, last_checked_commit
//   - body: last_known_head, worktree_status, active_batch_sentinel
//
// Does NOT touch reasoning fields (active_chapter, active_phase, active_batch,
// last_agreed_commit, next_action, open_conflict_threads, blocked_user_inputs,
// do_not_redo). Those are owned by main session.
//
// Output discipline: silent stdout; stderr only on actual failure.
// Always exits 0 — PreCompact failures must not abort compaction.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, basename } from 'node:path';

const REPO_ROOT = process.cwd();
const STATE_PATH = resolve(REPO_ROOT, '_workflow/STATE.md');
const REPO_NAME = basename(REPO_ROOT);
const WORKTREE_PATH = resolve(REPO_ROOT, '..', `${REPO_NAME}-codex-worktree`);
const SENTINEL_PATH = resolve(REPO_ROOT, '.claude/active_writer_batch.json');

if (!existsSync(STATE_PATH)) {
  // No STATE.md yet — no-op.
  process.exit(0);
}

function gitOutput(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  } catch (e) {
    return null;
  }
}

const head = gitOutput(['rev-parse', 'HEAD'], REPO_ROOT);
const mainStatus = gitOutput(['status', '--porcelain'], REPO_ROOT);
const worktreeExists = existsSync(WORKTREE_PATH);
const worktreeStatus = worktreeExists ? gitOutput(['status', '--porcelain'], WORKTREE_PATH) : null;

const isoNow = new Date().toISOString();

const mainClean = mainStatus === '';
const wtClean = worktreeStatus === '' || worktreeStatus === null;

let worktreeSummary;
if (!worktreeExists) {
  worktreeSummary = mainClean
    ? 'main clean; codex worktree not initialized'
    : `dirty (main: ${mainStatus.split('\n').filter(Boolean).length} entries); codex worktree not initialized`;
} else if (mainClean && wtClean) {
  worktreeSummary = 'clean (main + codex worktree)';
} else if (!mainClean && wtClean) {
  const n = mainStatus.split('\n').filter(Boolean).length;
  worktreeSummary = `dirty (main: ${n} entries); codex worktree clean`;
} else if (mainClean && !wtClean) {
  const n = (worktreeStatus || '').split('\n').filter(Boolean).length;
  worktreeSummary = `main clean; codex worktree dirty (${n} entries)`;
} else {
  const n1 = mainStatus.split('\n').filter(Boolean).length;
  const n2 = (worktreeStatus || '').split('\n').filter(Boolean).length;
  worktreeSummary = `dirty (main: ${n1} entries; codex worktree: ${n2} entries)`;
}

const sentinel = existsSync(SENTINEL_PATH) ? '`.claude/active_writer_batch.json` (active)' : 'null';

let content;
try {
  content = readFileSync(STATE_PATH, 'utf8');
} catch (e) {
  process.stderr.write(`[snapshot-state] cannot read STATE.md: ${e.message}\n`);
  process.exit(0);
}

const updated = content
  .replace(/^last_updated:.*$/m, `last_updated: ${isoNow}`)
  .replace(/^last_checked_commit:.*$/m, `last_checked_commit: ${head || 'unknown'}`)
  .replace(/^- last_known_head:.*$/m, `- last_known_head: \`${head || 'unknown'}\``)
  .replace(/^- worktree_status:.*$/m, `- worktree_status: ${worktreeSummary}`)
  .replace(/^- active_batch_sentinel:.*$/m, `- active_batch_sentinel: ${sentinel}`);

try {
  writeFileSync(STATE_PATH, updated);
} catch (e) {
  process.stderr.write(`[snapshot-state] cannot write STATE.md: ${e.message}\n`);
  process.exit(0);
}

process.exit(0);
