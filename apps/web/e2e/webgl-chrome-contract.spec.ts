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

/**
 * Elements that are always mounted, so their box can be compared across all
 * four presets. `wfs-chips` used to be listed here and matches nothing — the
 * chip bar's id is `wfs-chip-bar` — so the suite silently covered three
 * elements while reporting five. The assertion below now fails on a selector
 * that never appears, rather than skipping it.
 */
const CHROME_SELECTORS = [
  '[data-testid="tool-ribbon"]',
  '[data-testid="wfs-chip-bar"]',
  '[data-testid="depth-rail"]',
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
    // ?mode=survey: a fresh project with no site truth suggests SKETCH mode
    // (suggestedMode — the drawing-first flow), and the depth rail
    // legitimately returns null in sketch. The invariant under test is
    // camera-preset invariance, so pin a mode where the persistent chrome
    // actually mounts.
    await page.goto(`/projects/${projectId}?mode=survey`, {
      waitUntil: "networkidle",
    });

    // Wait for the WebGL studio to mount
    await expect(page.locator('[data-testid="webgl-canvas"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator('[data-testid="tool-ribbon"]')).toBeAttached();

    const selectors = [...CHROME_SELECTORS];

    // Capture bounding boxes for each chrome element in each camera preset.
    // We click the camera dock buttons to switch presets.
    const boxesByPreset: Record<
      string,
      Record<string, { x: number; y: number; width: number; height: number }>
    > = {};

    for (const preset of CAMERA_PRESETS) {
      // Click the camera dock button for this preset. The button must exist —
      // a missing selector used to skip the switch silently, which left every
      // preset capturing the same DOM and made the whole test vacuous.
      const dockButton = page.locator(
        `[data-testid="camera-dock"] button[data-camera-button="${preset}"]`,
      );
      await expect(
        dockButton,
        `camera dock has no ${preset} button — the test cannot switch presets`,
      ).toHaveCount(1);
      await dockButton.click();
      // Wait for the camera transition to settle (420ms transition + buffer)
      await page.waitForTimeout(600);

      // Capture bounding boxes for all chrome elements
      boxesByPreset[preset] = {};
      for (const selector of selectors) {
        const el = page.locator(selector);
        if (await el.isVisible()) {
          // LAYOUT box, not the painted box. The contract's rule is about
          // position: the depth rail legitimately skews in 3D, and a skew
          // changes what `boundingBox()` reports while leaving the element
          // exactly where it was laid out. offsetLeft/offsetTop/offsetWidth
          // ignore transforms, so this measures what §11c actually forbids.
          const box = await el.evaluate((node) => {
            const el2 = node as HTMLElement;
            let x = 0;
            let y = 0;
            let walk: HTMLElement | null = el2;
            while (walk) {
              x += walk.offsetLeft;
              y += walk.offsetTop;
              walk = walk.offsetParent as HTMLElement | null;
            }
            return { x, y, width: el2.offsetWidth, height: el2.offsetHeight };
          });
          if (box) {
            boxesByPreset[preset][selector] = box;
          }
        }
      }
    }

    // Every persistent element must have been captured in PLAN. A selector
    // that never matches is a broken test, not a passing one.
    for (const selector of CHROME_SELECTORS) {
      expect(
        boxesByPreset["plan"]?.[selector],
        `${selector} was never visible — selector is stale`,
      ).toBeDefined();
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
