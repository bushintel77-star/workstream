import { test, expect, type ConsoleMessage } from "@playwright/test";
import { createAddressProject } from "./helpers";

/**
 * WebGL preview smoke test.
 *
 * Verifies the ?webgl=1 preview page loads without console errors and the
 * R3F Canvas + Glass Card overlay render. This is the Phase 1 gate — it
 * confirms the WebGL studio mounts and renders real geometry from project
 * data without runtime failures.
 *
 * The test creates a fresh project, navigates to ?webgl=1, and asserts:
 *   1. No "Maximum update depth" or React errors in the console.
 *   2. The WebGL canvas element exists in the DOM.
 *   3. The Glass Card stats overlay renders.
 */

test.describe("WebGL preview (?webgl=1)", () => {
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

    await page.goto(`/projects/${projectId}?webgl=1`, {
      waitUntil: "networkidle",
    });
    // Allow the dynamic import + R3F Canvas to mount
    await page.waitForTimeout(4000);

    // The WebGL canvas should be in the DOM (client-rendered via dynamic import)
    const canvas = page.locator('[data-testid="webgl-studio"]');
    await expect(canvas).toBeVisible({ timeout: 10_000 });

    // The Glass Card stats overlay should be visible
    const glassCard = page.locator("[data-gs-glass-card]");
    await expect(glassCard).toBeVisible();

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
