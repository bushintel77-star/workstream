/**
 * Parse docs/design/TIER1-2026-SPEC-GAP-CHECKLIST.md.
 * With REQUIRE_TIER1_SPEC=1, fail if any P0 row has status=missing.
 * Always prints a JSON summary to stdout (last line) for agents.
 *
 * Usage: node scripts/check-tier1-2026-spec-gap.mjs
 */
import fs from "fs";
import path from "path";

const CHECKLIST = path.join(
  "docs",
  "design",
  "TIER1-2026-SPEC-GAP-CHECKLIST.md",
);

const raw = fs.readFileSync(CHECKLIST, "utf8");
const rows = [];

for (const line of raw.split(/\r?\n/)) {
  if (!line.startsWith("|")) continue;
  if (line.includes("|----") || line.includes("| id ")) continue;
  const cells = line
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim());
  if (cells.length < 6) continue;
  const [id, priority, status, clause, evidence, smoke] = cells;
  if (!id || id === "id") continue;
  rows.push({ id, priority, status, clause, evidence, smoke });
}

const p0Missing = rows.filter(
  (r) => r.priority === "P0" && r.status === "missing",
);
const summary = {
  total: rows.length,
  byStatus: rows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {}),
  p0Missing: p0Missing.map((r) => r.id),
};

console.log(
  `Tier-1 2026 gap checklist: ${rows.length} rows — ` +
    Object.entries(summary.byStatus)
      .map(([k, v]) => `${k}:${v}`)
      .join(" "),
);

const requireP0 =
  process.env.REQUIRE_TIER1_SPEC === "1" ||
  process.argv.includes("--require");

if (requireP0 && p0Missing.length) {
  console.error(
    `Tier-1 P0 missing → ${p0Missing.map((r) => r.id).join(", ")}`,
  );
  console.log(JSON.stringify(summary));
  process.exit(1);
}

if (p0Missing.length) {
  console.warn(
    `Warn: ${p0Missing.length} P0 missing (pass --require to fail): ` +
      p0Missing.map((r) => r.id).join(", "),
  );
}

console.log(JSON.stringify(summary));
