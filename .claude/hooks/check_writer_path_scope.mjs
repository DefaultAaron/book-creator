#!/usr/bin/env node
// PreToolUse hook for the writer-batch path-scope guard.
// Blocks Write/Edit calls outside the active batch's allowlist.
// Permissive (exit 0) when no batch sentinel is present.
//
// Claude Code PreToolUse exit code semantics:
//   0  = allow (success)
//   2  = block (denial — message goes to the model)
//   other = non-blocking error (logged, tool proceeds)
// We use 2 for every denial, including parse / safety failures.

import { readFileSync, existsSync, lstatSync, realpathSync } from 'node:fs';
import { resolve, relative, dirname, basename, join } from 'node:path';

const REPO_ROOT = process.cwd();
const SENTINEL_PATH = resolve(REPO_ROOT, '.claude/active_writer_batch.json');

if (!existsSync(SENTINEL_PATH)) {
  process.exit(0);
}

let payload;
try {
  payload = JSON.parse(readFileSync(0, 'utf8'));
} catch (e) {
  process.stderr.write(`[writer-path-scope] BLOCKED: cannot parse hook payload: ${e.message}\n`);
  process.exit(2);
}

const toolName = payload.tool_name;
if (toolName !== 'Write' && toolName !== 'Edit') {
  process.exit(0);
}

const filePath = payload.tool_input?.file_path;
if (!filePath) {
  process.stderr.write(`[writer-path-scope] BLOCKED: ${toolName} called without file_path while writer batch is active\n`);
  process.exit(2);
}

const absPath = resolve(REPO_ROOT, filePath);

// Symlink defense: if the file exists, it must not be a symbolic link.
if (existsSync(absPath)) {
  try {
    if (lstatSync(absPath).isSymbolicLink()) {
      process.stderr.write(`[writer-path-scope] BLOCKED: target '${relative(REPO_ROOT, absPath)}' is a symbolic link\n`);
      process.exit(2);
    }
  } catch (e) {
    process.stderr.write(`[writer-path-scope] BLOCKED: cannot lstat target: ${e.message}\n`);
    process.exit(2);
  }
}

// Symlink defense for parents: canonicalize the parent directory.
// If the parent doesn't exist yet, refuse — Write to a non-existent parent
// would be unusual for the writer pipeline.
let canonical;
try {
  const parentReal = realpathSync(dirname(absPath));
  canonical = join(parentReal, basename(absPath));
} catch (e) {
  process.stderr.write(`[writer-path-scope] BLOCKED: parent directory of '${relative(REPO_ROOT, absPath)}' cannot be resolved: ${e.message}\n`);
  process.exit(2);
}

const repoReal = realpathSync(REPO_ROOT);
if (!canonical.startsWith(repoReal + '/') && canonical !== repoReal) {
  process.stderr.write(`[writer-path-scope] BLOCKED: canonical path '${canonical}' is outside the repo root '${repoReal}'\n`);
  process.exit(2);
}

let sentinel;
try {
  sentinel = JSON.parse(readFileSync(SENTINEL_PATH, 'utf8'));
} catch (e) {
  process.stderr.write(`[writer-path-scope] BLOCKED: cannot parse sentinel file: ${e.message}\n`);
  process.exit(2);
}

const allowedPaths = sentinel.allowed_paths || [];
if (!Array.isArray(allowedPaths)) {
  process.stderr.write(`[writer-path-scope] BLOCKED: sentinel.allowed_paths is not an array\n`);
  process.exit(2);
}

const allowedCanonical = allowedPaths.map(p => {
  const abs = resolve(REPO_ROOT, p);
  try {
    const parentReal = realpathSync(dirname(abs));
    return join(parentReal, basename(abs));
  } catch {
    return abs;
  }
});

if (allowedCanonical.includes(canonical)) {
  process.exit(0);
}

process.stderr.write(
  `[writer-path-scope] BLOCKED: ${toolName} to '${relative(REPO_ROOT, absPath)}' is outside the active writer batch allowlist.\n` +
  `Allowed paths: ${allowedPaths.join(', ') || '(none)'}\n`
);
process.exit(2);
