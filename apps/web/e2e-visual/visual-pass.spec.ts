import { test, expect, type APIRequestContext } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

/**
 * Visual pass for the first-load chain:
 *   01 landing: empty Sketch board, hint visible, plain drag PANS (no ink)
 *   02 clear look at the hint
 *   03 CAD mode: working-drawing dimension ring visible
 *   04 SCALE toggle OFF: dim ring retires
 *   05 after arming the pen and drawing: hint retires, ink visible
 *
 * Note: entering Sketch via Shift+2 arms sketch ink by design (mode entry),
 * so the pan-law check runs on the LANDING state before any mode switch.
 */

const API = process.env.API_URL ?? "http://127.0.0.1:3101";
const SHOT_DIR = path.resolve(__dirname, "../../../gui-test-screenshots/visual-pass");

const BOUNDARY = [
  { x_pct: 15, y_pct: 10 },
  { x_pct: 85, y_pct: 10 },
  { x_pct: 85, y_pct: 90 },
  { x_pct: 15, y_pct: 90 },
];

// Flat levels — a raised terrain buried the flat pen ink (ink renders at
// y≈0.02; plan view does not drape it) so the pass seeds a level site.
const LEVELS = [
  { x_pct: 25, y_pct: 25, z_m: 0.0, source: "authored" as const },
  { x_pct: 75, y_pct: 25, z_m: 0.0, source: "authored" as const },
  { x_pct: 25, y_pct: 75, z_m: 0.1, source: "authored" as const },
  { x_pct: 75, y_pct: 75, z_m: 0.1, source: "authored" as const },
];

async function createProject(request: APIRequestContext) {
  const create = await request.post(`${API}/projects/`, {
    data: {
      address: "Visual Pass Fixture, Prahran VIC 3181",
      lat: -37.85,
      lng: 145.0,
    },
  });
  expect(create.ok(), "create project").toBeTruthy();
  const body = (await create.json()) as { project: { id: string } };
  return body.project.id;
}

async function seedCanvas(request: APIRequestContext, projectId: string) {
  const res = await request.put(`${API}/projects/${projectId}/design-canvas`, {
    data: {
      placements: [],
      strokes: [],
      irrigation_zones: [],
      features: [],
      site_frame: {
        boundary: BOUNDARY,
        building: [],
        easements: [],
        services: [],
        levels: LEVELS,
        byda_assets: [],
        neighbour_buildings: [],
        keyless_overlays: [],
      },
    },
  });
  expect(res.ok(), "seed design-canvas").toBeTruthy();
}

function shot(name: string) {
  return path.join(SHOT_DIR, name);
}

test("visual pass: landing pan -> hint -> scale toggle -> pen draw", async ({
  page,
  request,
}) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });

  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const projectId = await createProject(request);
  await seedCanvas(request, projectId);
  console.log(`visual-pass project: ${projectId}`);

  // ---- 01/02: land in Sketch, empty board, guided hint visible ----
  await page.goto(`/projects/${projectId}`, { waitUntil: "domcontentloaded" });
  const toggle = page.getByTestId("scale-toggle");
  await expect(toggle).toBeVisible({ timeout: 150_000 });
  const hint = page.getByTestId("first-move-hint");
  await expect(hint).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: shot("01-loaded-sketch.png") });
  await page.screenshot({ path: shot("02-first-move-hint.png") });

  // ---- Pan law BEFORE any mode switch: plain drag must not create ink ----
  const chrome = page.locator('[data-webgl-chrome]');
  const box = await chrome.boundingBox();
  expect(box).not.toBeNull();
  const cx = box!.x + box!.width * 0.55;
  const cy = box!.y + box!.height * 0.55;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 140, cy - 60, { steps: 16 });
  await page.mouse.up();
  // Hint stays — no ink was created, so the landing state pans.
  await expect(hint).toBeVisible();

  // ---- 03: CAD mode auto-arms the dimension ring (scale toggle ON) ----
  await page.keyboard.press("Shift+3");
  const dimLabel = page.locator('[data-testid="dim-label"]');
  await expect(dimLabel.first()).toBeVisible({ timeout: 45_000 });
  await expect(toggle).toHaveAttribute("data-toggled", "on");
  await page.screenshot({ path: shot("03-cad-dims-on.png") });

  // ---- 04: SCALE toggle OFF retires the dimension ring ----
  await toggle.click();
  await expect(toggle).toHaveAttribute("data-toggled", "off");
  await expect(dimLabel).toHaveCount(0, { timeout: 20_000 });
  await page.screenshot({ path: shot("04-scale-off-no-dims.png") });

  // back ON
  await toggle.click();
  await expect(toggle).toHaveAttribute("data-toggled", "on");
  await expect(dimLabel.first()).toBeVisible({ timeout: 20_000 });

  // ---- 05: back to Sketch (mode entry arms sketch ink by design), pen draw ----
  await page.keyboard.press("Shift+2");
  await expect(hint).toBeVisible({ timeout: 30_000 });
  await page.locator('[data-tool-id="pen"]').click();
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 140, cy - 60, { steps: 16 });
  await page.mouse.up();
  await expect(page.getByTestId("first-move-hint")).toHaveCount(0, {
    timeout: 30_000,
  });
  await page.screenshot({ path: shot("05-after-stroke-hint-retired.png") });

  expect(errors, `browser errors:\n${errors.join("\n")}`).toEqual([]);
});
