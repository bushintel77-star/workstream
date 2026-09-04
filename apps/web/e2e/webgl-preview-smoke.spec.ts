import { test, expect, type ConsoleMessage } from "@playwright/test";
import { createAddressProject } from "./helpers";

/**
 * WebGL preview smoke test.
 *
 * Verifies the studio page loads without console errors and the R3F Canvas
 * mounts. This is the Phase 1 gate — it confirms the WebGL studio mounts and
 * renders without runtime failures.
 *
 * The test creates a fresh project, navigates to the studio, and asserts:
 *   1. No "Maximum update depth" or React errors in the console.
 *   2. The WebGL canvas element exists in the DOM.
 *   3. Persistent chrome (tool ribbon + camera dock) renders.
 *
 * The original third assertion — the Glass Card stats overlay — died with
 * the zero-chrome purge (`58bc9f6`): the resting HUD cards were removed and
 * GlassCard now only mounts behind mode-specific surfaces, so a resting-page
 * assertion on it tested a retired layout.
 */

test.describe("WebGL studio smoke", () => {
  test("renders the R3F canvas without console errors", async ({
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
      address: "1 WebGL Test Street, Melbourne VIC 3000",
    });

    await page.goto(`/projects/${projectId}?mode=survey`, {
      waitUntil: "networkidle",
    });
    // Allow the dynamic import + R3F Canvas to mount
    await page.waitForTimeout(4000);

    // The WebGL canvas should be in the DOM (client-rendered via dynamic import)
    const canvas = page.locator('[data-testid="webgl-studio"]');
    await expect(canvas).toBeVisible({ timeout: 10_000 });

    // Persistent chrome renders: the tool ribbon and the camera dock.
    await expect(page.locator('[data-testid="tool-ribbon"]')).toBeVisible();
    await expect(page.locator('[data-testid="camera-dock"]')).toBeVisible();

    // No React render loops or fatal errors
    const fatal = errors.filter(
      (e) =>
        e.includes("Maximum update depth") ||
        e.includes("TypeError") ||
        e.includes("ReferenceError"),
    );
    expect(fatal, `Fatal console errors:\n${fatal.join("\n")}`).toHaveLength(0);
  });
});
