import { test, expect, type ConsoleMessage } from "@playwright/test";
import { createAddressProject } from "./helpers";

/** Prefer 127.0.0.1 — `localhost` can resolve to ::1 while the API binds IPv4. */
const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/**
 * Row / hedge mass-plant e2e.
 *
 * The linear counterpart to webgl-asset-fanout.spec.ts: one drag must plant a
 * whole evenly spaced run, preview the mature spacing before it commits, and
 * survive the autosave round-trip.
 *
 *   1. Assets dock → Row plant → arm the pleached hornbeam.
 *   2. Drag a run across the lot; the in-canvas spacing guide reports the
 *      stem count and the realised centre-to-centre spacing in metres.
 *   3. Releasing plants exactly the previewed stems (stats I<n>, n > 1).
 *   4. After the autosave, a reload rehydrates the same count.
 *   5. No fatal console errors.
 */
test.describe("WebGL asset row plant (hedge run + persist)", () => {
  // Two full WebGL studio mounts (initial + reload) plus a debounced autosave
  // round-trip — the 90s default leaves no headroom on cold hardware.
  test.setTimeout(180_000);
  test("drag a run, the whole hedge persists across reload", async ({
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
      address: "1 Hedge Row Street, Melbourne VIC 3000",
    });

    // A near-full-lot title boundary: the run is reconciled against it, and a
    // centred drag sits well inside so nothing is trimmed.
    const seed = await request.put(`${API}/projects/${projectId}/design-canvas`, {
      data: {
        placements: [],
        strokes: [],
        irrigation_zones: [],
        site_frame: {
          boundary: [
            { x_pct: 2, y_pct: 2 },
            { x_pct: 98, y_pct: 2 },
            { x_pct: 98, y_pct: 98 },
            { x_pct: 2, y_pct: 98 },
          ],
          building: [],
          easements: [],
          services: [],
          levels: [],
        },
      },
    });
    expect(seed.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}?webgl=1`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(4000);
    await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
      timeout: 10_000,
    });

    // 1. Open the dock, arm the row tool, then arm the hedge symbol.
    await page.getByRole("button", { name: "▸ Assets" }).click();
    const dock = page.locator('[data-testid="asset-dock"]');
    await expect(dock).toBeVisible({ timeout: 5_000 });
    await page.locator('[data-testid="asset-row-plant"]').click();
    await page.locator('[data-testid="asset-card-hornbeam-pleached"]').click();
    await expect(dock).toContainText("row-plant", { timeout: 5_000 });

    // 2. Drag the run. The guide must read out before the commit.
    const canvas = page.locator('[data-testid="webgl-canvas"]');
    const box = (await canvas.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx - 140, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy, { steps: 6 });
    await page.mouse.move(cx + 140, cy, { steps: 6 });

    const readout = page.locator('[data-testid="plant-spacing-readout"]');
    await expect(readout).toBeVisible({ timeout: 5_000 });
    await expect(readout).toContainText("m centres");
    const previewText = (await readout.textContent()) ?? "";
    const previewed = Number(/(\d+)\s+stem/.exec(previewText)?.[1] ?? "0");
    expect(previewed).toBeGreaterThan(1);

    await page.mouse.up();

    // 3. One drag = the whole run, exactly as previewed.
    const stats = page.locator('[data-testid="perimeter-tab-strip"]');
    await expect(stats).toContainText(`I${previewed}`, { timeout: 10_000 });

    // Wait for the debounced autosave before reloading (fanout spec pattern).
    await expect(stats).toContainText(/Saved/, { timeout: 15_000 });

    // 4. Reload — the whole run rehydrates.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.locator('[data-testid="perimeter-tab-strip"]'),
    ).toContainText(`I${previewed}`, { timeout: 10_000 });

    // The guides are preview only — nothing persisted them.
    await expect(
      page.locator('[data-testid="plant-spacing-readout"]'),
    ).toHaveCount(0);

    // 5. No fatal console errors.
    const fatal = errors.filter(
      (e) =>
        e.includes("Maximum update depth") ||
        e.includes("TypeError") ||
        e.includes("ReferenceError"),
    );
    expect(fatal, `Fatal console errors:\n${fatal.join("\n")}`).toHaveLength(0);
  });
});
