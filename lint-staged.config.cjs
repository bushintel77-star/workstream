/**
 * lint-staged passes the matched file paths as positional args to each
 * command. Our typecheck script runs `tsc --noEmit -p tsconfig.json` per
 * workspace, which won't accept file args. Using a function (returning a
 * string) tells lint-staged to skip the file-list append.
 */
module.exports = {
  "**/*.{ts,tsx}": () => "pnpm -w typecheck",
};
