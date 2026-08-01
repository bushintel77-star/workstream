/**
 * CI gate: fail if apps/mobile/app.json still contains the EAS init placeholder.
 * Cross-platform replacement for the previous `grep` shell command.
 */
import fs from "node:fs";

const TARGET = "apps/mobile/app.json";
const NEEDLE = "REPLACE_AFTER_eas_init";

const raw = fs.readFileSync(TARGET, "utf8");
if (raw.includes(NEEDLE)) {
  console.error(`FAIL: placeholder "${NEEDLE}" still in ${TARGET}`);
  process.exit(1);
}

console.log(`ok: no "${NEEDLE}" placeholder in ${TARGET}`);
