/**
 * Pre-commit scope. The invariant this file has to hold:
 *
 *   a green hook means the commit will not break `pnpm run ci` for a reason
 *   the hook could have seen.
 *
 * Until 2026-08-22 the only entry here was `pnpm -w typecheck`, so a green hook
 * meant "it compiles" and nothing else. An ESLint config refactor was committed
 * behind that green hook with a broken unit test, and CI caught what the hook
 * should have. Every command below exists because of a specific way the old
 * hook let a red gate through.
 *
 * Latency matters as much as coverage: a hook slow enough to be worth
 * `--no-verify` protects nothing. Warm, the whole set is under ten seconds —
 * typecheck is turbo-cached, ESLint sees only staged files, Vitest sees only
 * related specs, and the nine repo ratchets are pure file readers.
 *
 * lint-staged passes matched paths as positional args. Commands that take a
 * file list receive it; commands that operate on the whole project (typecheck)
 * are returned from a function that ignores the list, which is what tells
 * lint-staged not to append it.
 */
const fs = require("node:fs");
const path = require("node:path");

/** lint-staged hands over absolute paths; the tools all want repo-relative. */
const rel = (files) =>
  files.map((f) => path.relative(process.cwd(), f).replace(/\\/g, "/"));

/**
 * The roots the root `lint` script passes to ESLint. Staging a file outside
 * them (a `.mjs` gate script, `apps/mobile`) must not invoke ESLint on a path
 * the config ignores — that exits non-zero with "all files ignored" and trains
 * people to bypass the hook.
 */
const LINTED_ROOTS =
  "{apps/api,apps/web,packages/contracts,packages/db,packages/domain,packages/ui}/src/**/*.{ts,tsx}";

module.exports = {
  /*
   * Runs whatever is staged, including a lone `eslint.config.mjs`, a `.css`
   * token edit or a `package.json` script change — none of which match a
   * `*.{ts,tsx}` glob, and all of which can take CI red.
   *
   * typecheck is here rather than under the ts/tsx glob so that editing only
   * `tsconfig.json` still typechecks. Warm it is a turbo cache hit.
   */
  "*": () => [
    "pnpm -w typecheck",
    "node scripts/precommit-repo-gates.mjs",
  ],

  /*
   * The staged files only. `--max-warnings 0` matches the root script exactly:
   * `no-unused-vars` is configured at "warn", and warnings are what proved five
   * shipped-inert features in apps/web, so a hook that tolerated them would
   * miss the class of defect this gate exists for.
   */
  [LINTED_ROOTS]: (files) =>
    `pnpm exec eslint ${rel(files).join(" ")} --max-warnings 0`,

  /*
   * A gate's self-test is the only thing proving that gate still fails when it
   * should, and `pnpm run ci` runs it. At 3.4s it is too slow to pay on every
   * commit and exactly right on the commits that touch the gate it guards, so
   * it is paired by filename rather than listed in the always-on set. Pairing
   * beats a hardcoded list for the same reason the scraping-spec scan is
   * discovered: the next `*.selftest.mjs` is covered the day it is written.
   */
  "scripts/*.mjs": (files) => {
    const staged = rel(files);
    const selftests = new Set(
      staged.filter((f) => f.endsWith(".selftest.mjs")),
    );
    for (const f of staged) {
      const paired = f.replace(/\.mjs$/, ".selftest.mjs");
      if (fs.existsSync(paired)) selftests.add(paired);
    }
    return [...selftests].map((f) => `node ${f}`);
  },

  /*
   * Vitest's related-tests mode: the specs whose module graph reaches a staged
   * file, not the full 1,985-case suite. Specs that read repo files as text
   * instead of importing them are invisible to this and are run unconditionally
   * by scripts/precommit-repo-gates.mjs.
   *
   * `--exclude` with the stress glob (doublestar, star, "stress", star,
   * ".test.ts"): the tier1 stress suites sit in the
   * import graph of the api/domain libs and multiply a ~25s pipeline by 15–25
   * iterations — 3–8 minutes in a hook slow enough to train `--no-verify`.
   * They own the dedicated `stress` CI job (ci.yml) with their own budget;
   * `pnpm test:stress` runs them locally.
   */
  "**/*.{ts,tsx}": (files) =>
    /* `--silent=true`, not `--silent`: a bare flag swallows the first path. */
    `pnpm exec vitest related --run --silent=true --exclude '**/*stress*.test.ts' ${rel(files).join(" ")}`,
};
