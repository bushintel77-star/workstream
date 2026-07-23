/**
 * Download Temaki CC0 plant / shrub / groundcover / tree plan icons.
 * Source: https://github.com/rapideditor/temaki (CC0-1.0)
 * Run: node packages/domain/scripts/download-temaki-plants.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../assets/temaki-plants");

/** Landscape planting glyphs only — map furniture noise excluded. */
const FILES = [
  "garden_bed.svg",
  "grass.svg",
  "hedge.svg",
  "island_trees_building.svg",
  "islet_tree.svg",
  "lawn.svg",
  "plant.svg",
  "shrub.svg",
  "shrub_low.svg",
  "tree_and_bench.svg",
  "tree_broadleaved.svg",
  "tree_cactus.svg",
  "tree_leafless.svg",
  "tree_needleleaved.svg",
  "tree_palm.svg",
  "tree_row.svg",
  "tree_stump.svg",
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

console.log(`Downloaded ${ok}/${FILES.length} Temaki plant SVGs → ${outDir}`);
