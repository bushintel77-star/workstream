import { test, expect, type ConsoleMessage } from "@playwright/test";
import { createAddressProject } from "./helpers";

/** Prefer 127.0.0.1 — `localhost` can resolve to ::1 while the API binds IPv4. */
const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/**
 * CAD annotation instruments e2e — dimension ring + measure tape (Gap 3 port).
 *
 * Seeds a rectangular lot + building (guaranteeing decluttered dim labels),
 * then verifies on the WebGL studio:
 *
 *   1. Dimension labels render as DOM chips (drei <Html>) with real metres.
 *   2. The Dims chip toggles them off/on.
 *   3. The Measure tool arms, a real canvas drag lays a tape, and the DOM
 *      readout reports a metres figure.
 *   4. No fatal console errors.
 */

test.describe("WebGL CAD annotations (dims + measure tape)", () => {
  test("dimension labels render and the measure tape drag reports metres", async ({
    page,
    request,
  }) => {
    // Live (LIVE_E2E) runs hit production latency + a heavier page.
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on("console", (msg: ConsoleMessage) => {
      if (msg.type() === "error") errors.push(msg.text().slice(0, 300));
    });
    page.on("pageerror", (err: Error) =>
      errors.push(`${err.name}: ${err.message.slice(0, 300)}`),
    );

    const { projectId } = await createAddressProject(request, {
      address: "1 CAD Annotations Street, Melbourne VIC 3000",
    });

    // Rectangular boundary + building via the canvas PUT — guarantees the
    // B…/F… dimension ring has clean edges to label.
    const seed = await request.put(
      `${API}/projects/${projectId}/design-canvas`,
      {
        data: {
          placements: [],
          strokes: [],
          irrigation_zones: [],
          site_frame: {
            boundary: [
              { x_pct: 20, y_pct: 15 },
              { x_pct: 80, y_pct: 15 },
              { x_pct: 80, y_pct: 85 },
              { x_pct: 20, y_pct: 85 },
            ],
            building: [
              { x_pct: 35, y_pct: 25 },
              { x_pct: 65, y_pct: 25 },
              { x_pct: 65, y_pct: 45 },
              { x_pct: 35, y_pct: 45 },
            ],
            building_source: "traced",
            easements: [],
            services: [],
            levels: [],
          },
        },
      },
    );
    expect(seed.ok()).toBeTruthy();

    // Explicit ?mode=cad. This navigated with no mode until 2026-08-22 and
    // relied on the store's `dimsView: true` default to have a ring to assert —
    // which is exactly the default that put a dimension ring over a Survey lot
    // the operator was still establishing. Dims are now armed by mode entry
    // (`modeArmsDims`), so the spec that tests the CAD dimension ring has to
    // actually be in CAD.
    await page.goto(`/projects/${projectId}?mode=cad`, {
      // domcontentloaded (not networkidle): production keeps background
      // polling alive, so networkidle never settles there.
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(4000);

    await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
      timeout: 10_000,
    });

    // 1. Dimension labels render as DOM chips with metres text.
    const dimLabels = page.locator('[data-testid="dim-label"]');
    await expect(dimLabels.first()).toBeVisible({ timeout: 5_000 });
    const labelCount = await dimLabels.count();
    expect(labelCount).toBeGreaterThanOrEqual(3);
    await expect(dimLabels.first()).toContainText(/ m$/);

    // 2. The working-drawing dims toggle (command palette — the "▾ Dims"
    //    chip this spec used to click was removed with the chrome
    //    consolidation; the palette command is the current surface) turns
    //    the ring off and back on. Asserted per family: the building
    //    F-dims exist only under dimsView; boundary chips may also light
    //    via Bearings, so only the building family is guaranteed to clear.
    const buildingLabels = page.locator(
      '[data-testid="dim-label"][data-dim-family="building"]',
    );
    const boundaryLabels = page.locator(
      '[data-testid="dim-label"][data-dim-family="boundary"]',
    );
    await expect(buildingLabels.first()).toBeVisible();
    await expect(boundaryLabels.first()).toBeVisible();

    await page.keyboard.press("Control+k");
    const palette = page.locator('[data-testid="studio-command-palette"]');
    await expect(palette).toBeVisible({ timeout: 5_000 });
    await page.locator('[data-testid="command-tool-dims"]').click();
    await expect(buildingLabels).toHaveCount(0);

    await page.keyboard.press("Control+k");
    await expect(palette).toBeVisible({ timeout: 5_000 });
    await page.locator('[data-testid="command-tool-dims"]').click();
    await expect(buildingLabels.first()).toBeVisible();
    await expect(dimLabels.first()).toBeVisible();

    // 3. Arm the measure tape (palette command — the "▸ Measure" chip is
    //    gone with the same consolidation) and drag a line across the canvas.
    await page.keyboard.press("Control+k");
    await expect(palette).toBeVisible({ timeout: 5_000 });
    await page.locator('[data-testid="command-tool-measure"]').click();

    const canvas = page.locator('[data-testid="webgl-canvas"]');
    const box = (await canvas.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx - 120, cy - 60);
    await page.mouse.down();
    await page.mouse.move(cx + 120, cy + 60, { steps: 8 });
    await page.mouse.up();

    // The tape's midpoint label (drei <Html> span). Was `measure-readout`
    // before the 2026-08 zero-chrome purge renamed it `measure-label`.
    const readout = page.locator('[data-testid="measure-label"]');
    await expect(readout).toBeVisible({ timeout: 5_000 });
    await expect(readout).toContainText(/\d+\.\d{2} m/);

    // 4. No fatal console errors.
    const fatal = errors.filter(
      (e) =>
        e.includes("Maximum update depth") ||
        e.includes("TypeError") ||
        e.includes("ReferenceError"),
    );
    expect(fatal, `Fatal console errors:\n${fatal.join("\n")}`).toHaveLength(0);
  });
});
