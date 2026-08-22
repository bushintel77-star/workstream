import { expect, test } from "@playwright/test";
import { createAddressProject } from "./helpers";

/**
 * WebGL chrome detector (Gold Standard 2026 replacement for gate C).
 *
 * The old canvas-chrome-detector.spec.ts asserted that no [data-camera-chrome]
 * lived inside [data-testid=zoom-world] (the CSS-transform camera). Under WebGL
 * the camera is a Three.js camera, not a CSS transform — the equivalent rule is:
 *
 *   No DOM chrome renders inside the R3F <Canvas> element.
 *   All overlay chrome lives in the sibling [data-testid=webgl-chrome-overlay] div.
 *
 * Wiring (corrected 2026-08-22 — the previous note claimed this was "authored
 * but not yet wired into CI" and that it "skips if the WebGL studio is not
 * found"; neither was true). `playwright.config.ts` sets `testDir: ./e2e` with
 * no filter, so the GitLab `e2e` job runs this spec in its shard sweep. That
 * job is `allow_failure: true` by design — GPU-less shared runners fall back to
 * software WebGL — so it reports without blocking. There is no skip path: the
 * spec hard-asserts the R3F canvas is visible and fails if the studio is
 * absent, which is the correct behaviour now that WebGLStudio is the only
 * canvas surface.
 */

test.describe("WebGL chrome detector (gate C successor)", () => {
  test("no DOM chrome inside the R3F Canvas", async ({ page, request }) => {
    const { projectId } = await createAddressProject(request, {
      address: "1 WebGL Chrome Gate Street, Melbourne VIC 3000",
    });
    await page.goto(`/projects/${projectId}?webgl=1`, {
      waitUntil: "networkidle",
    });

    const canvas = page.locator('[data-testid="webgl-canvas"]');
    const overlay = page.locator('[data-testid="webgl-chrome-overlay"]');
    await expect(canvas).toBeVisible({ timeout: 10_000 });
    await expect(overlay).toBeAttached();
    await expect(canvas.locator("[data-gs-glass-card], [data-camera-chrome]")).toHaveCount(0);

    expect(
      await canvas.evaluate((element) => {
        const studio = element.closest('[data-testid="webgl-studio"]');
        const chrome = studio?.querySelector('[data-testid="webgl-chrome-overlay"]');
        return Boolean(studio && chrome && !element.contains(chrome));
      }),
    ).toBe(true);
  });
});
