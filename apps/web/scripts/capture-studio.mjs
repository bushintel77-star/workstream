/**
 * Capture the survey-dock collision state for visual review.
 *
 * Assumes `pnpm dev` is running (API on :3001, web on :3002), then:
 *   1. creates a seeded project (placements + boundary -> a live estimate),
 *   2. opens it in survey mode,
 *   3. saves shots/dock-collapsed.png (estimate = compact pill),
 *   4. expands the estimate and saves shots/dock-expanded.png.
 *
 * Run from apps/web:  node scripts/capture-studio.mjs
 * Give the two PNGs back to the agent for a vision review.
 */
import { chromium } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";
const WEB = process.env.WEB_URL ?? "http://127.0.0.1:3002";
// Windows-safe output dir: apps/web/shots (NOT .pathname of a file:// URL,
// which prepends a leading slash and mangles to C:\C:\...).
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "shots");
mkdirSync(OUT, { recursive: true });
console.log(`SHOTS_DIR ${OUT}`);

const place = (symbol_id, x_pct, y_pct) => ({
  id: randomUUID(),
  symbol_id,
  x_pct,
  y_pct,
  rotation_deg: 0,
  scale: 1,
});

async function main() {
  const created = await fetch(`${API}/projects/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address: "Auto-trace probe, Melbourne VIC 3000",
      lat: -37.8,
      lng: 144.96,
    }),
  });
  const { project } = await created.json();

  const seeded = await fetch(`${API}/projects/${project.id}/design-canvas`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      placements: [
        place("olive-standard", 40, 45),
        place("bluestone-paver", 60, 55),
        place("hornbeam-pleached", 50, 32),
      ],
      strokes: [],
      irrigation_zones: [],
      site_frame: {
        boundary: [
          { x_pct: 15, y_pct: 10 },
          { x_pct: 85, y_pct: 10 },
          { x_pct: 85, y_pct: 90 },
          { x_pct: 15, y_pct: 90 },
        ],
        building: [
          { x_pct: 35, y_pct: 18 },
          { x_pct: 65, y_pct: 18 },
          { x_pct: 65, y_pct: 32 },
          { x_pct: 35, y_pct: 32 },
        ],
        building_source: "traced",
        easements: [],
        services: [],
        levels: [
          { x_pct: 25, y_pct: 25, z_m: 50.0, source: "authored" },
          { x_pct: 75, y_pct: 25, z_m: 49.8, source: "authored" },
          { x_pct: 25, y_pct: 75, z_m: 51.2, source: "authored" },
          { x_pct: 75, y_pct: 75, z_m: 51.0, source: "authored" },
        ],
      },
    }),
  });
  if (!seeded.ok) throw new Error(`seed ${seeded.status} ${await seeded.text()}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 950 },
  });

  await page.goto(`${WEB}/projects/${project.id}?webgl=1&mode=survey`, {
    waitUntil: "networkidle",
  });
  await page.locator('[data-testid="webgl-studio"]').waitFor({ timeout: 20_000 });

  // Let the estimate worker settle; wait for either the pill or the card.
  await page.waitForTimeout(5000);

  // Full page so we can see the canvas + dock together.
  await page.screenshot({ path: `${OUT}/dock-full.png`, fullPage: true });

  // Collapsed (default) state — the compact running-estimate pill.
  const pill = page.getByTestId("fit-sheet-pill");
  if (await pill.count()) {
    await page.screenshot({ path: `${OUT}/dock-collapsed.png` });
    await pill.click({ force: true });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/dock-expanded.png` });
  } else {
    console.warn("fit-sheet-pill not found — estimate may not have settled; check /shots");
  }

  console.log(`PROJECT ${project.id}`);
  for (const f of readdirSync(OUT)) {
    if (f.endsWith(".png")) {
      console.log(`WROTE ${path.join(OUT, f)} (${statSync(path.join(OUT, f)).size} bytes)`);
    }
  }
  console.log("DONE");
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
