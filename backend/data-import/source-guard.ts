/**
 * Safety guard for the confidential source spreadsheets (`data-import/source/`).
 *
 * The .xlsx in that folder hold real GSM supplier data. They are placed on the server by
 * hand, read once by the import scripts, and deleted from disk right after — they are
 * NEVER versioned (see the comment above `data-import/source/` in backend/.gitignore).
 *
 * `backend/.gitignore` is what enforces that today, and a one-line edit to it would
 * silently undo the whole thing: the next spreadsheet would be trackable, and nobody
 * would notice until it was already in a commit (purging it afterwards means rewriting
 * history on every remote). This guard makes that failure loud instead: before any
 * spreadsheet is read, `git check-ignore` has to agree the path is ignored.
 *
 * It only ever fires when something is misconfigured. A normal import — files correctly
 * ignored — passes through untouched, and a deployment that is not a git work tree at
 * all (nothing to leak into) skips the check with a warning rather than aborting.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Paths already cleared, so repeated reads of one sheet cost a single `git` call. */
const cleared = new Set<string>();
/** `null` until the first check resolves it. */
let insideWorkTree: boolean | null = null;

/** Runs git, returning its stdout — never throws, so a missing git is just an empty result. */
function git(args: string[], cwd: string): string {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

/**
 * Aborts unless `file` is covered by .gitignore. Call it immediately before reading a
 * source spreadsheet; `file` must be an absolute path.
 */
export function assertGitIgnored(file: string): void {
  if (cleared.has(file)) return;

  const dir = path.dirname(file);
  const base = path.basename(file);

  // No folder means no spreadsheet to protect — let the caller's read report the
  // missing file, which is a clearer error than anything this guard could add.
  if (!fs.existsSync(dir)) return;

  if (insideWorkTree === null) {
    insideWorkTree = git(['rev-parse', '--is-inside-work-tree'], dir).trim() === 'true';
    if (!insideWorkTree) {
      console.warn(`[import] .gitignore guard skipped — ${dir} is not inside a git work tree.`);
    }
  }
  if (!insideWorkTree) {
    cleared.add(file);
    return;
  }

  // `git check-ignore` echoes back the paths an ignore rule covers, and stays silent for
  // files that are already tracked. Both ways of getting this wrong — a broken .gitignore
  // and a spreadsheet somebody already ran `git add` on — therefore land in the throw.
  const ignored = git(['check-ignore', '--', base], dir)
    .split('\n')
    .map(line => line.trim())
    .includes(base);

  if (!ignored) {
    throw new Error(
      `refusing to read a source spreadsheet that git is not ignoring:\n` +
      `  ${file}\n\n` +
      `  These spreadsheets hold confidential supplier data and must never reach a commit.\n` +
      `  \`git check-ignore\` does not cover this path, which means either backend/.gitignore\n` +
      `  no longer ignores \`data-import/source/\`, or the file is already tracked\n` +
      `  (untrack it with \`git rm --cached\`).\n\n` +
      `  Restore the ignore rule, then run the import again.`,
    );
  }

  cleared.add(file);
}
