import { test, expect } from "@playwright/test";
import path from "node:path";
import { randomUUID } from "node:crypto";

const API = process.env.API_URL ?? "http://127.0.0.1:3101";

const BOUNDARY = [
  { x_pct: 15, y_pct: 10 },
  { x_pct: 85, y_pct: 10 },
  { x_pct: 85, y_pct: 90 },
  { x_pct: 15, y_pct: 90 },
];

// A gentle slope so the section profile is visible, not a flat line.
const LEVELS = [
  { x_pct: 20, y_pct: 20, z_m: 0.0, source: "authored" as const },
  { x_pct: 80, y_pct: 20, z_m: 1.2, source: "authored" as const },
  { x_pct: 20, y_pct: 80, z_m: 2.4, source: "authored" as const },
  { x_pct: 80, y_pct: 80, z_m: 3.6, source: "authored" as const },
];

// A raised pad crossing the middle of the cut — fill band material.
const PAD_STROKE = {
  id: randomUUID(),
  points: [
    { x_pct: 30, y_pct: 40 },
    { x_pct: 70, y_pct: 40 },
    { x_pct: 70, y_pct: 60 },
    { x_pct: 30, y_pct: 60 },
    { x_pct: 30, y_pct: 40 },
  ],
  color: "#3B3B3B",
  width_px: 2.5,
  kind: "ink" as const,
  extrude_height_m: 1.0,
};

test("section renderer: SECTION tool arms cut + profile curtain", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const dir = path.resolve(__dirname, "../../../gui-test-screenshots/visual-pass");
  const create = await request.post(`${API}/projects/`, {
    data: { address: "Section Visual Fixture, Prahran VIC 3181", lat: -37.85, lng: 145.0 },
  });
  expect(create.ok(), "create").toBeTruthy();
  const id = ((await create.json()) as { project: { id: string } }).project.id;
  const put = await request.put(`${API}/projects/${id}/design-canvas`, {
    data: {
      placements: [],
      strokes: [PAD_STROKE],
      irrigation_zones: [],
      features: [],
      site_frame: {
        boundary: BOUNDARY,
        easements: [],
        services: [],
        levels: LEVELS,
        byda_assets: [],
      },
    },
  });
  expect(put.ok(), `seed design-canvas ${put.status()}`).toBeTruthy();

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(`/projects/${id}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("scale-toggle")).toBeVisible({ timeout: 150_000 });

  await page.locator('[data-tool-id="section"]').click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(dir, "section-01-plan.png") });

  // SEC view — the profile curtain read in elevation.
  await page.keyboard.press("3");
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(dir, "section-02-sec.png") });

  expect(errors, `browser errors:\n${errors.join("\n")}`).toEqual([]);
});
