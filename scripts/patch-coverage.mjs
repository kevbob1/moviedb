#!/usr/bin/env node
/**
 * Patch (diff) coverage gate.
 *
 * Runs the Jest suite with JSON coverage output, measures coverage of only the
 * lines added by the current change, and fails when that patch coverage is
 * below PATCH_COVERAGE_THRESHOLD (default 95%).
 *
 * Diff base resolution (first one that resolves wins):
 *   1. BASE_REF env var
 *   2. merge-base(HEAD, origin/main), falling back to origin/main itself
 *   3. merge-base(HEAD, main), falling back to main itself
 *   4. HEAD~1
 *
 * Coverage is measured against the working tree (`git diff <base>`), so
 * uncommitted edits are gated too; on a clean checkout this is identical to
 * `git diff <base>...HEAD`. Untracked non-test `.ts` files under the coverage
 * globs count as entirely added (they are invisible to `git diff` until they
 * are staged; `git add -N <file>` also makes them visible).
 *
 * A line is "measurable" when it falls inside a statement recorded in
 * coverage/coverage-final.json (blank lines, comments and other
 * non-executable lines are excluded from the denominator).
 *
 * Graceful degradation: this gate needs `git`. When `git` is unavailable or
 * the working directory is not a git work tree, it prints a SKIP notice and
 * exits 0 with no measurement. That is the only path that passes without
 * measuring; a missing diff base is an error.
 *
 * Env:
 *   BASE_REF                  commit-ish to diff against (overrides auto-detect)
 *   PATCH_COVERAGE_THRESHOLD  minimum patch coverage percentage (default 95)
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const THRESHOLD = Number(process.env.PATCH_COVERAGE_THRESHOLD ?? "95");
const COVERAGE_DIR = "coverage";
const COVERAGE_FILE = path.join(COVERAGE_DIR, "coverage-final.json");
const LOG_PREFIX = "[patch-coverage]";

if (!Number.isFinite(THRESHOLD) || THRESHOLD < 0 || THRESHOLD > 100) {
  console.error(
    `${LOG_PREFIX} PATCH_COVERAGE_THRESHOLD must be a number between 0 and 100 (got "${process.env.PATCH_COVERAGE_THRESHOLD}")`,
  );
  process.exit(1);
}

function git(args, options = {}) {
  return spawnSync("git", ["-c", "safe.directory=*", ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    ...options,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
  });
}

function gitUnavailable() {
  const version = git(["--version"]);
  return version.error !== undefined || version.status !== 0;
}

function resolveRepoRoot() {
  const res = git(["rev-parse", "--show-toplevel"]);
  if (res.status !== 0) return null;
  const root = res.stdout.trim();
  return root === "" ? null : root;
}

function commitOf(ref) {
  const res = git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
  if (res.status !== 0) return null;
  const sha = res.stdout.trim();
  return sha === "" ? null : sha;
}

function resolveBase() {
  const explicit = process.env.BASE_REF?.trim();
  const refs = explicit ? [explicit] : ["origin/main", "main", "HEAD~1"];

  for (const ref of refs) {
    const refSha = commitOf(ref);
    if (!refSha) continue;

    const mergeBase = git(["merge-base", "HEAD", ref]);
    const mergeBaseSha =
      mergeBase.status === 0 ? mergeBase.stdout.trim() : "";
    return {
      ref,
      sha: mergeBaseSha === "" ? refSha : mergeBaseSha,
      usedMergeBase: mergeBaseSha !== "",
      explicit: Boolean(explicit),
    };
  }

  return null;
}

function parseAddedLines(diffText) {
  /** @type {Map<string, Set<number>>} */
  const files = new Map();
  let current = null;
  let inHunk = false;

  for (const line of diffText.split("\n")) {
    if (line.startsWith("diff --git ")) {
      current = null;
      inHunk = false;
      continue;
    }
    // Inside a hunk, "+++ ..." is added content, not a file header.
    if (!inHunk && line.startsWith("+++ ")) {
      const header = line.slice(4).trim();
      if (header === "/dev/null") {
        current = null;
      } else {
        const file = header.replace(/^b\//, "").replace(/^"|"$/g, "");
        current = file;
        if (!files.has(file)) files.set(file, new Set());
      }
      continue;
    }
    if (current === null || !line.startsWith("@@")) continue;

    const match = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (!match) continue;
    inHunk = true;
    const start = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);
    const lines = files.get(current);
    for (let i = 0; i < count; i += 1) lines.add(start + i);
  }

  return files;
}

function normalizePath(root, filePath) {
  const relative = path.isAbsolute(filePath)
    ? path.relative(root, filePath)
    : filePath;
  return relative.split(path.sep).join("/").replace(/^\.\//, "");
}

function loadCoverage(root) {
  const coveragePath = path.join(root, COVERAGE_FILE);
  if (!existsSync(coveragePath)) return null;

  const data = JSON.parse(readFileSync(coveragePath, "utf8"));
  /** @type {Map<string, Map<number, number>>} */
  const coverage = new Map();

  for (const entry of Object.values(data)) {
    if (!entry || typeof entry !== "object" || typeof entry.path !== "string") {
      continue;
    }
    const file = normalizePath(root, entry.path);
    const lineHits = coverage.get(file) ?? new Map();

    for (const [id, statement] of Object.entries(entry.statementMap ?? {})) {
      const hits = Number(entry.s?.[id] ?? 0);
      const firstLine = statement.start?.line;
      const lastLine = statement.end?.line ?? firstLine;
      if (typeof firstLine !== "number") continue;
      for (let line = firstLine; line <= lastLine; line += 1) {
        lineHits.set(line, Math.max(lineHits.get(line) ?? 0, hits));
      }
    }

    coverage.set(file, lineHits);
  }

  return coverage;
}

function untrackedSourceFiles(root) {
  const res = git(
    ["ls-files", "--others", "--exclude-standard", "--", "."],
    { cwd: root },
  );
  if (res.status !== 0) return [];

  return res.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => file.endsWith(".ts"))
    .filter((file) => !/(^|\/)__tests__\//.test(file))
    .filter((file) => !/\.test\.ts$/.test(file))
    .filter((file) => file.startsWith("src/lib/"))
    .map((file) => normalizePath(root, file));
}

function runJest(root) {
  const jestBin = path.join(root, "node_modules", "jest", "bin", "jest.js");
  if (!existsSync(jestBin)) {
    console.error(
      `${LOG_PREFIX} cannot find ${jestBin}; run this gate through "npm run coverage:patch" inside the dev container`,
    );
    return 1;
  }

  console.log(`${LOG_PREFIX} running jest with JSON coverage output...`);
  const res = spawnSync(
    process.execPath,
    [
      jestBin,
      "--coverage",
      "--coverageReporters=json",
      "--coverageDirectory=coverage",
      "--silent",
    ],
    { cwd: root, stdio: "inherit" },
  );
  if (res.error) {
    console.error(`${LOG_PREFIX} failed to run jest: ${res.error.message}`);
    return 1;
  }
  return res.status ?? 1;
}

function main() {
  if (gitUnavailable()) {
    console.warn(
      `${LOG_PREFIX} SKIP: git is not available in this environment; patch coverage was not measured.`,
    );
    process.exit(0);
  }

  const root = resolveRepoRoot();
  if (!root) {
    console.warn(
      `${LOG_PREFIX} SKIP: not inside a git work tree; patch coverage was not measured.`,
    );
    process.exit(0);
  }

  const base = resolveBase();
  if (!base) {
    console.error(
      `${LOG_PREFIX} cannot determine a diff base (tried BASE_REF, origin/main, main, HEAD~1). Set BASE_REF=<ref> and retry.`,
    );
    process.exit(1);
  }

  const jestStatus = runJest(root);
  if (jestStatus !== 0) {
    console.error(
      `${LOG_PREFIX} jest failed (exit ${jestStatus}); patch coverage not evaluated.`,
    );
    process.exit(1);
  }

  const diff = git(["diff", "-U0", "--no-color", base.sha, "--", "."], {
    cwd: root,
  });
  if (diff.status !== 0) {
    console.error(
      `${LOG_PREFIX} git diff failed: ${diff.stderr.trim() || `exit ${diff.status}`}`,
    );
    process.exit(1);
  }

  const added = parseAddedLines(diff.stdout);
  for (const file of untrackedSourceFiles(root)) {
    if (added.has(file)) continue;
    const abs = path.join(root, file);
    if (!existsSync(abs)) continue;
    const lineCount = readFileSync(abs, "utf8").split("\n").length;
    added.set(
      file,
      new Set(Array.from({ length: lineCount }, (_, index) => index + 1)),
    );
  }

  const coverage = loadCoverage(root);
  if (!coverage) {
    console.error(
      `${LOG_PREFIX} ${COVERAGE_FILE} was not produced by jest; cannot evaluate patch coverage.`,
    );
    process.exit(1);
  }

  let coveredLines = 0;
  let measurableLines = 0;
  const uncovered = [];
  const unmeasuredFiles = [];

  for (const [file, lines] of [...added.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const lineHits = coverage.get(file);
    if (!lineHits) {
      if (lines.size > 0) unmeasuredFiles.push(file);
      continue;
    }
    for (const line of [...lines].sort((a, b) => a - b)) {
      const hits = lineHits.get(line);
      if (hits === undefined) continue;
      measurableLines += 1;
      if (hits > 0) {
        coveredLines += 1;
      } else {
        uncovered.push(`${file}:${line}`);
      }
    }
  }

  const baseDescription = `${base.ref} (${base.sha.slice(0, 12)}${
    base.usedMergeBase ? ", merge-base with HEAD" : ""
  })`;

  if (measurableLines === 0) {
    const reason =
      added.size === 0
        ? "no changed lines"
        : "no measurable added lines in covered files";
    console.log(
      `${LOG_PREFIX} PASS: ${reason} against ${baseDescription}; nothing to measure.`,
    );
    process.exit(0);
  }

  const percentage = (coveredLines / measurableLines) * 100;
  const formatted = percentage.toFixed(2);
  const summary = `${coveredLines}/${measurableLines} added lines covered (${formatted}%, threshold ${THRESHOLD}%) against ${baseDescription}`;

  if (percentage >= THRESHOLD) {
    console.log(`${LOG_PREFIX} PASS: ${summary}`);
    if (unmeasuredFiles.length > 0) {
      console.log(
        `${LOG_PREFIX} note: ${unmeasuredFiles.length} changed file(s) are outside the coverage report and were ignored.`,
      );
    }
    process.exit(0);
  }

  console.error(`${LOG_PREFIX} FAIL: ${summary}`);
  console.error(`${LOG_PREFIX} uncovered added lines:`);
  const limit = 100;
  for (const entry of uncovered.slice(0, limit)) {
    console.error(`  ${entry}`);
  }
  if (uncovered.length > limit) {
    console.error(`  ... and ${uncovered.length - limit} more`);
  }
  process.exit(1);
}

main();
