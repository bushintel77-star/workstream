import { test, expect, type ConsoleMessage } from "@playwright/test";
import { createAddressProject } from "./helpers";

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
      `http://127.0.0.1:3001/projects/${projectId}/design-canvas`,
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

    await page.goto(`/projects/${projectId}?webgl=1`, {
      waitUntil: "networkidle",
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

    // 2. The Dims chip toggles the ring off and back on.
    const dimsChip = page.getByRole("button", { name: "▾ Dims" });
    await dimsChip.click();
    await expect(page.locator('[data-testid="dim-label"]')).toHaveCount(0);
    await page.getByRole("button", { name: "▸ Dims" }).click();
    await expect(dimLabels.first()).toBeVisible();

    // 3. Arm the measure tape and drag a line across the canvas.
    await page.getByRole("button", { name: "▸ Measure" }).click();
    await expect(
      page.getByRole("button", { name: "▾ Measure" }),
    ).toBeVisible();

    const canvas = page.locator('[data-testid="webgl-canvas"]');
    const box = (await canvas.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx - 120, cy - 60);
    await page.mouse.down();
    await page.mouse.move(cx + 120, cy + 60, { steps: 8 });
    await page.mouse.up();

    const readout = page.locator('[data-testid="measure-readout"]');
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
