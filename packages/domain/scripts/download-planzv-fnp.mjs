/**
 * Download CC0 PlanZV FNP landscape / open-space SVGs (geoObserver/PlanZV-FNP).
 * Run: node packages/domain/scripts/download-planzv-fnp.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../assets/planzv-fnp");

/** Landscape / open-space / water / protection — useful for AI CAD site design. */
const FILES = [
  "FNP_016_Naturschutzgebiet.svg",
  "FNP_045_Wasser.svg",
  "FNP_049_Parkanlage.svg",
  "FNP_050_Dauerkleingaerten.svg",
  "FNP_051_Sportplatz.svg",
  "FNP_054_Badeplatz_Freibad.svg",
  "FNP_059_Ueberschwemmungsgebiet.svg",
  "FNP_077_Landschaftsschutzgebiet.svg",
  "FNP_079_Naturdenkmal.svg",
  "FNP_080_Geschuetzter_Landschaftsbestandteil.svg",
  "FNP_089_begruenter_Stadtplatz.svg",
  "FNP_090_Eigentuemergarten_Grabeland.svg",
  "FNP_146_Wassersportanlage.svg",
  "FNP_154_Flaechennaturdenkmal.svg",
  "FNP_156_Verkehrsbegleitgruen.svg",
  "FNP_201_Erholungswald.svg",
  "FNP_204_Schutzspflanzung_Ortsrandeingruenung.svg",
  "FNP_215_Golfanlage_.svg",
  "FNP_302_FFH_Richtline.svg",
  "FNP_303_Vogelschutzgebiet.svg",
];

const BASE =
  "https://raw.githubusercontent.com/geoObserver/PlanZV-FNP/master/collections/PLANZV-FNP/svg";

fs.mkdirSync(outDir, { recursive: true });

for (const file of FILES) {
  const url = `${BASE}/${file}`;
  const dest = path.join(outDir, file);
  process.stdout.write(`GET ${file}… `);
  const res = await fetch(url);
  if (!res.ok) {
    console.log(`FAIL ${res.status}`);
    continue;
  }
  const body = await res.text();
  fs.writeFileSync(dest, body, "utf8");
  console.log("ok");
}

console.log(`Downloaded ${FILES.length} PlanZV SVGs ? ${outDir}`);
