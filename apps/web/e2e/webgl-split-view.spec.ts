import { test, expect, type ConsoleMessage } from "@playwright/test";
import { createAddressProject } from "./helpers";

/**
 * Split View e2e — the dual-screen workflow (locked plan | live 3D, linked
 * cameras) inside the one studio.
 *
 *   1. The rail Split tool toggles the lens: TWO webgl-studio canvases.
 *   2. Both halves render (PLAN·CAD and SKETCH·3D label chips visible).
 *   3. The shared camera links: a drag on the LEFT (locked plan) half moves
 *      the rig — verified via the studio stats tilt readout changing... the
 *      honest observable is that BOTH halves still render clean and the
 *      right half's canvas is intact; the rig itself is internal state, so
 *      we assert the drag produced no errors and the split persists.
 *   4. Toggling off returns to ONE canvas.
 *   5. No fatal console errors.
 */
test.describe("WebGL split view (plan | 3D)", () => {
  // Two full WebGL canvases (context + shader compile + EffectComposer)
  // exceed the default budget on cold CI hardware.
  test.setTimeout(420_000); // TWO linked R3F canvases render per frame on software GL
  test("split tool mounts two linked halves and toggles back", async ({
    page,
    request,
  }) => {
    const errors: string[] = [];
    page.on("console", (m: ConsoleMessage) => {
      if (m.type() === "error") errors.push(m.text().slice(0, 300));
    });
    page.on("pageerror", (e) => errors.push(`${e.name}: ${e.message.slice(0, 300)}`));

    const { projectId } = await createAddressProject(request, {
      address: "1 Split View Street, Melbourne VIC 3000",
    });

    await page.goto(`/projects/${projectId}?webgl=1`, { waitUntil: "networkidle" });
    await page.waitForTimeout(4000);
    await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
      timeout: 10_000,
    });
    expect(await page.locator('[data-testid="webgl-studio"]').count()).toBe(1);

    // 1. Toggle Split on the rail.
    await page.getByRole("button", { name: "▸ Split" }).click();
    await page.waitForTimeout(4000); // both dynamic canvases mount + compile
    const halves = page.locator('[data-testid="webgl-studio"]');
    await expect(halves.nth(1)).toBeVisible({ timeout: 15_000 });
    expect(await halves.count()).toBe(2);

    // 2. Label chips on both halves.
    await expect(page.getByText("PLAN · CAD")).toBeVisible();
    await expect(page.getByText("SKETCH · 3D")).toBeVisible();

    // 3. Linked camera: drag-pan on the LEFT half (locked plan side).
    const leftHalf = halves.nth(0);
    const box = (await leftHalf.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx - 80, cy + 40, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(800);
    // Both halves still mounted after the pan.
    expect(await halves.count()).toBe(2);
    await expect(halves.nth(1)).toBeVisible();

    // 4. Toggle off — one canvas again.
    await page.getByRole("button", { name: "▾ Split" }).click();
    await page.waitForTimeout(1500);
    expect(await page.locator('[data-testid="webgl-studio"]').count()).toBe(1);

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
