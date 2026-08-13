import { expect, test } from "@playwright/test";

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
 * This probe is authored but not yet wired into CI — it activates when the
 * WebGLStudio is mounted on the project page (Phase 1 completion). Until then
 * it skips if the WebGL studio is not found.
 */

test.describe("WebGL chrome detector (gate C successor)", () => {
  test("no DOM chrome inside the R3F Canvas", async ({ page }) => {
    test.skip(
      true,
      "WebGLStudio not yet mounted on project pages — activates in Phase 1",
    );
    // Placeholder: once WebGLStudio is mounted, this test will:
    // 1. Navigate to a project in CAD mode
    // 2. Assert [data-testid=webgl-canvas] exists
    // 3. Assert [data-testid=webgl-chrome-overlay] is a sibling (not a child)
    // 4. Assert no [data-gs-glass-card] or [data-camera-chrome] is found
    //    inside the <canvas> element
  });
});
