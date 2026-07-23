/**
 * Download Temaki CC0 hardscape / lighting / site furniture icons.
 * Source: https://github.com/rapideditor/temaki (CC0-1.0)
 * Run: node packages/domain/scripts/download-temaki-site.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../assets/temaki-site");

/** Landscape hardscape + lighting glyphs — rail/power noise excluded. */
const FILES = [
  "bench.svg",
  "bollard.svg",
  "bollard_row.svg",
  "bridge.svg",
  "campfire.svg",
  "fireplace.svg",
  "fountain.svg",
  "gate.svg",
  "guard_rail.svg",
  "kerb-flush.svg",
  "kerb-lowered.svg",
  "kerb-raised.svg",
  "kerb-rolled.svg",
  "mast_lighting.svg",
  "picnic_shelter.svg",
  "railing.svg",
  "rope_fence.svg",
  "sculpture.svg",
  "spa.svg",
  "speed_table.svg",
  "street_lamp_arm.svg",
  "tall_gate.svg",
  "utility_pole.svg",
  "wall.svg",
  "waste.svg",
];

const BASE =
  "https://raw.githubusercontent.com/rapideditor/temaki/main/icons";

fs.mkdirSync(outDir, { recursive: true });

let ok = 0;
for (const file of FILES) {
  const dest = path.join(outDir, file);
  process.stdout.write(`GET ${file}… `);
  const res = await fetch(`${BASE}/${file}`);
  if (!res.ok) {
    console.log(`FAIL ${res.status}`);
    continue;
  }
  fs.writeFileSync(dest, await res.text(), "utf8");
  ok += 1;
  console.log("ok");
}

console.log(`Downloaded ${ok}/${FILES.length} Temaki site SVGs → ${outDir}`);
