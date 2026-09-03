import { expect, test } from "@playwright/test";
import { createAddressProject } from "./helpers";

/**
 * Phase L.10 — no chrome element bounding box changes between camera states.
 *
 * The chrome contract's first rule (spec §11c): "nothing in the chrome changes
 * POSITION between camera states." Every element does exactly one of four
 * things (same / convert / lock / hide) — but none of them move. This test
 * captures the bounding box of every persistent chrome surface across all
 * four camera presets (PLAN / AXO / SEC / 3D) and asserts the position +
 * dimensions are invariant.
 *
 * Hidden elements (per the contract) are excluded — they have no box when
 * hidden. Elements that convert may change CONTENT but not POSITION.
 */

const CHROME_SELECTORS = [
  '[data-testid="tool-ribbon"]',
  '[data-testid="wfs-chips"]',
  '[data-testid="depth-rail"]',
  '[data-testid="coord-chip"]',
  '[data-testid="scale-toggle"]',
] as const;

const CAMERA_PRESETS = ["plan", "axo", "sec", "3d"] as const;

test.describe("Phase L.10 — chrome bounding box invariant across camera states", () => {
  test("no chrome element changes position between camera presets", async ({
    page,
    request,
  }) => {
    const { projectId } = await createAddressProject(request, {
      address: "1 Chrome Contract Test Street, Melbourne VIC 3000",
    });
    await page.goto(`/projects/${projectId}?webgl=1`, {
      waitUntil: "networkidle",
    });

    // Wait for the WebGL studio to mount
    await expect(page.locator('[data-testid="webgl-canvas"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator('[data-testid="tool-ribbon"]')).toBeAttached();

    // Capture bounding boxes for each chrome element in each camera preset.
    // We click the camera dock buttons to switch presets.
    const boxesByPreset: Record<string, Record<string, DOMRect>> = {};

    for (const preset of CAMERA_PRESETS) {
      // Click the camera dock button for this preset
      const dockButton = page.locator(
        `[data-testid="camera-dock"] button[data-camera-button="${preset}"]`,
      );
      if (await dockButton.count()) {
        await dockButton.click();
        // Wait for the camera transition to settle (420ms transition + buffer)
        await page.waitForTimeout(600);
      }

      // Capture bounding boxes for all chrome elements
      boxesByPreset[preset] = {};
      for (const selector of CHROME_SELECTORS) {
        const el = page.locator(selector);
        if (await el.isVisible()) {
          const box = await el.boundingBox();
          if (box) {
            boxesByPreset[preset][selector] = box;
          }
        }
      }
    }

    // Assert: for each element that is visible in PLAN, its bounding box
    // (x, y, width, height) is the same in every other preset where it is
    // also visible. Position invariance — content may change, box may not.
    const planBoxes = boxesByPreset["plan"] ?? {};
    for (const [selector, planBox] of Object.entries(planBoxes)) {
      for (const preset of CAMERA_PRESETS) {
        const presetBox = boxesByPreset[preset]?.[selector];
        if (!presetBox) continue; // hidden in this preset — allowed

        // Position invariance: x and y must not change
        expect(
          presetBox.x,
          `${selector} x changed in ${preset}`,
        ).toBeCloseTo(planBox.x, 0);
        expect(
          presetBox.y,
          `${selector} y changed in ${preset}`,
        ).toBeCloseTo(planBox.y, 0);

        // Dimension invariance: width and height must not change.
        // (Convert elements may change content but not their box.)
        expect(
          presetBox.width,
          `${selector} width changed in ${preset}`,
        ).toBeCloseTo(planBox.width, 0);
        expect(
          presetBox.height,
          `${selector} height changed in ${preset}`,
        ).toBeCloseTo(planBox.height, 0);
      }
    }
  });
});
