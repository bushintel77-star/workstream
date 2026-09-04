import { test, expect, type ConsoleMessage } from "@playwright/test";
import { createAddressProject } from "./helpers";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/**
 * Sketch assist + Tidy Z-routing e2e (gap-analysis Phase 1, 2026-09-04).
 *
 * Covers the operator loop the unit tests can't see end-to-end:
 *   1. A closed freehand loop commits ink and spawns the Tidy HUD at the
 *      pen lift (bed classification → PLT default).
 *   2. Cycling the HUD's plane toggle lifts the preview ghost (the ghost
 *      is scene geometry — asserted by testid, judged visually by the
 *      captured screenshots in test-results).
 *   3. Hold-to-straighten: a held straightish stroke commits without the
 *      HUD hijack when Escape is pressed (assist, never constrain).
 *   4. No fatal console errors.
 *
 * Screenshots are captured at each step — this spec doubles as the visual
 * evidence pass for the sketch chrome.
 */

test.describe("WebGL sketch assist + Tidy Z-routing", () => {
  test("closed loop spawns Tidy HUD; plane cycle previews; hold straightens", async ({
    page,
    request,
  }) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on("console", (msg: ConsoleMessage) => {
      if (msg.type() === "error") errors.push(msg.text().slice(0, 300));
    });
    page.on("pageerror", (err: Error) =>
      errors.push(`${err.name}: ${err.message.slice(0, 300)}`),
    );

    const { projectId } = await createAddressProject(request, {
      address: "1 Sketch Assist Street, Melbourne VIC 3000",
    });
    const seed = await request.put(`${API}/projects/${projectId}/design-canvas`, {
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
            { x_pct: 55, y_pct: 25 },
            { x_pct: 55, y_pct: 45 },
            { x_pct: 35, y_pct: 45 },
          ],
          building_source: "traced",
          easements: [],
          services: [],
          levels: [],
        },
      },
    });
    expect(seed.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}?mode=sketch`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
      timeout: 30_000,
    });
    await page.waitForTimeout(4_000);

    // Arm the pen — `?mode=sketch` deliberately stays un-armed (deep-link
    // entry resolves the camera, not the tool; WebGLStudioPreview §423).
    // The PEN rail tile bridges activeTool → sketchMode in the store.
    await page.getByRole("button", { name: "PEN (P)" }).click();
    await page.waitForTimeout(400);

    const canvas = page.locator('[data-testid="webgl-canvas"]');
    const box = (await canvas.boundingBox())!;
    // The loop's board-% centre (65, 30) → screen px via the canvas box.
    const cx = box.x + box.width * 0.65;
    const cy = box.y + box.height * 0.3;
    const r = Math.min(box.width, box.height) * 0.06;

    // 1. Closed freehand loop → Tidy HUD at the pen lift.
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8]);
    }
    await page.mouse.move(pts[0]![0], pts[0]![1]);
    await page.mouse.down();
    for (const [x, y] of pts.slice(1)) await page.mouse.move(x, y, { steps: 2 });
    await page.mouse.move(pts[0]![0] + 3, pts[0]![1] + 2);
    await page.mouse.up();
    await page.screenshot({
      path: "test-results/sketch-assist-1-tidy-hud.png",
      fullPage: false,
    });
    await expect(page.locator('[data-testid="tidy-hud"]')).toBeVisible({
      timeout: 5_000,
    });
    // The guided first-sketch hint must retire once ink lands — it exists
    // to prompt the first stroke, not to outlive it.
    await expect(page.locator('[data-testid="first-move-hint"]')).toHaveCount(0);
    // Bed default = planting plane.
    await expect(page.locator('[data-testid="tidy-plane-toggle"]')).toHaveAttribute(
      "data-plane",
      "planting",
    );

    // 2. Cycle to massing — the preview ghost lifts in-scene. The ghost is
    //    R3F scene geometry (no DOM node), so the lifted preview is verified
    //    visually by the captured screenshot, not by a locator.
    await page.locator('[data-testid="tidy-plane-toggle"]').click();
    await expect(page.locator('[data-testid="tidy-plane-toggle"]')).toHaveAttribute(
      "data-plane",
      "massing",
    );
    await page.waitForTimeout(600); // spring settle for the ghost lift
    await page.screenshot({
      path: "test-results/sketch-assist-2-preview-massing.png",
      fullPage: false,
    });

    // 3. ESC dismisses without committing (assist, never constrain).
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-testid="tidy-hud"]')).toHaveCount(0);

    // 4. Hold-to-straighten: a line-intending stroke held before lift
    //    commits as a straight chord. Drawn thin + straight → ditch class.
    const lx = box.x + box.width * 0.3;
    const ly = box.y + box.height * 0.7;
    await page.mouse.move(lx, ly);
    await page.mouse.down();
    await page.mouse.move(lx + box.width * 0.25, ly - 6, { steps: 10 });
    await page.waitForTimeout(500); // the hold
    await page.mouse.up();
    await page.screenshot({
      path: "test-results/sketch-assist-3-straightened.png",
      fullPage: false,
    });
    // The ditch classification would spawn a HUD (ground default) — dismiss.
    const hud = page.locator('[data-testid="tidy-hud"]');
    if (await hud.isVisible().catch(() => false)) {
      await page.keyboard.press("Escape");
    }

    const fatal = errors.filter(
      (e) =>
        e.includes("Maximum update depth") ||
        e.includes("TypeError") ||
        e.includes("ReferenceError"),
    );
    expect(fatal, `Fatal console errors:\n${fatal.join("\n")}`).toHaveLength(0);
  });
});
