/**
 * Generate a sample branded HTML quote so you can see the production UI
 * without spinning up Expo. Writes to docs/sample-quote.html — double-click
 * to open in any browser.
 *
 * Run from repo root:
 *   pnpm --filter @construct/api exec tsx scripts/sample-output.ts
 */
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { renderHtml } from "../src/lib/html-render";
import { generateForKind } from "../src/lib/output-generators";

const project = {
  id: "00000000-0000-0000-0000-000000000001",
  owner_id: "dev-user",
  address: "36 Wrights Terrace, Prahran VIC 3181",
  lat: -37.8497,
  lng: 145.0189,
  created_at: new Date().toISOString(),
  status: "outputs" as const,
};

const survey = {
  id: "00000000-0000-0000-0000-000000000002",
  project_id: project.id,
  aerial_uri: "https://example.com/aerial.jpg",
  title_polygon: { type: "Polygon" as const, coordinates: [[[0, 0], [0, 1]]] },
  house_polygon: { type: "Polygon" as const, coordinates: [[[0, 0], [0, 1]]] },
  garden_polygon: { type: "Polygon" as const, coordinates: [[[0, 0], [0, 1]]] },
  lot_area_m2: 624,
  house_area_m2: 168,
  garden_area_m2: 456,
  measurements: [
    { edge_id: "front", length_m: 15.2, bearing_deg: 90, label: "Frontage" },
    { edge_id: "east", length_m: 41.1, bearing_deg: 0, label: "East boundary" },
    { edge_id: "back", length_m: 15.2, bearing_deg: 270, label: "Rear" },
    { edge_id: "west", length_m: 41.1, bearing_deg: 180, label: "West boundary" },
  ],
};

const design = {
  id: "00000000-0000-0000-0000-000000000003",
  project_id: project.id,
  mode: "validate" as const,
  version: 1,
  rationale:
    "A two-zone scheme honouring the Victorian-era streetscape: a disciplined mass-planted Lomandra front with a single Capital Pear standard, and a paved rear terrace anchored by a pleached hornbeam screen along the western boundary. Lighting and irrigation considered from the outset so the garden performs across the seasons without staff.",
  gaps: [],
  proposal: {
    estimated_complexity: "standard" as const,
    zones: [
      {
        id: "front-garden",
        name: "Front garden",
        treatment:
          "Mass planting of Lomandra ‘Tanika’ in disciplined blocks, framed by a single Pyrus 'Capital' standard set back from the front fence. Low maintenance, drought-tolerant, no irrigation per the brief.",
        plantings: [
          { species: "Lomandra 'Tanika'", common_name: "Fine-leaf Mat Rush", count: 36, form: "mass", sku: "PLT-LOM-140" },
          { species: "Pyrus calleryana 'Capital'", common_name: "Capital Pear", count: 1, form: "tree", sku: "PLT-PYR-100" },
        ],
        hardscape: [],
        lighting: [],
        irrigation: [],
      },
      {
        id: "rear-terrace",
        name: "Rear terrace",
        treatment:
          "Bluestone sawn paving from the kitchen door to the rear boundary, framed by a pleached Carpinus 'Frans Fontaine' hedge along the west boundary at 2.4m. Brass uplights pick out the screen and key trees at dusk; drip irrigation to all planted beds.",
        plantings: [
          { species: "Carpinus betulus 'Frans Fontaine'", common_name: "Pleached European Hornbeam", count: 6, form: "hedge", sku: "PLT-CARP-PL24" },
        ],
        hardscape: [
          { item: "Bluestone paving, sawn 600×400×30", qty: 38, unit: "m2", sku: "PAV-BLUE-SAWN" },
        ],
        lighting: [
          { fixture: "12V brass spike uplight, 4W 3000K", count: 8, sku: "LGT-UP-BRASS" },
        ],
        irrigation: [
          { item: "Drip line, 13mm with emitters", qty: 22, unit: "lm", sku: "IRR-DRIP" },
        ],
      },
    ],
  },
};

const costing = {
  id: "00000000-0000-0000-0000-000000000004",
  design_id: design.id,
  scenario: "standard" as const,
  line_items: [
    { sku: "PLT-LOM-140", label: "Lomandra Tanika 140mm — Front garden", unit: "ea", qty: 36, rate: 11, total: 396, is_provisional: false },
    { sku: "PLT-PYR-100", label: "Pyrus 'Capital' 100L — Front garden", unit: "ea", qty: 1, rate: 320, total: 320, is_provisional: false },
    { sku: "PLT-CARP-PL24", label: "Carpinus 'Frans Fontaine' pleached 2.4m — Rear terrace", unit: "ea", qty: 6, rate: 480, total: 2880, is_provisional: false },
    { sku: "PAV-BLUE-SAWN", label: "Bluestone paving, sawn — Rear terrace", unit: "m2", qty: 38, rate: 120, total: 4560, is_provisional: false },
    { sku: "LGT-UP-BRASS", label: "12V brass spike uplight — Rear terrace", unit: "ea", qty: 8, rate: 145, total: 1160, is_provisional: false },
    { sku: "IRR-DRIP", label: "Drip line 13mm — Rear terrace", unit: "lm", qty: 22, rate: 4, total: 88, is_provisional: false },
    { sku: "ALW-CONT-STD", label: "Contingency — Standard scenario", unit: "% of subtotal", qty: 1, rate: 470.2, total: 470.2, is_provisional: false },
  ],
  subtotal: 9874.2,
  gst: 987.42,
  total: 10861.62,
};

const audit = {
  id: "00000000-0000-0000-0000-000000000005",
  design_id: design.id,
  findings: [],
  blocking_count: 0,
  advisory_count: 0,
  passed: true,
};

async function main() {
  const args = { project, survey, design, costings: [costing], audit, tasks: [] };
  const md = generateForKind("quote", args);
  const html = renderHtml({ kind: "quote", project, markdown: md });

  const out = path.resolve(__dirname, "../../../docs/sample-quote.html");
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, html, "utf8");

  console.log(`✓ Sample quote written to: ${out}`);
  console.log("  Double-click to open, or:");
  console.log(`  open "${out}"   (macOS)`);
  console.log(`  start "${out}"  (Windows)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
