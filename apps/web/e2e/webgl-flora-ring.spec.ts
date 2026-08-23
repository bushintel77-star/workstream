import { test, expect, type ConsoleMessage } from "@playwright/test";
import { createAddressProject } from "./helpers";

/**
 * Flora Ring e2e (Gap 5 part 3 — ranked planting suggestions).
 *
 * Verifies the AI suggestion layer on the WebGL studio:
 *   1. Arming a PLANT card (canopy) and clicking the lot opens the ranked
 *      ring (not a direct placement) — candidate chips + the sun/exposure
 *      chip render.
 *   2. Accepting the active candidate places it — Items: 1.
 *   3. No fatal console errors.
 */
test.describe("WebGL flora ring (ranked suggestions)", () => {
  test("plant card click opens the ring; accept places the candidate", async ({
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
      address: "36 Wrights Terrace, Prahran VIC 3181",
    });

    await page.goto(`/projects/${projectId}?webgl=1`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(4000);

    await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
      timeout: 10_000,
    });

    // Arm the canopy (olive) card — a flora form. Armed feedback is the
    // floating placement toolbar (the dock "Armed" pill was retired).
    await page.getByRole("button", { name: "▸ Assets" }).click();
    await page.locator('[data-testid="asset-card-olive-standard"]').click();
    await expect(
      page.locator('[data-testid="floating-placement-toolbar"]'),
    ).toBeVisible({ timeout: 5_000 });

    // Click the lot — the RING opens (not a placement).
    const canvas = page.locator('[data-testid="webgl-canvas"]');
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    const ring = page.locator('[data-testid="flora-ring"]');
    await expect(ring).toBeVisible({ timeout: 8_000 });

    // Candidate chips + the sun/exposure readout (Solar Impact delta).
    const chips = ring.locator('[data-testid^="flora-chip-"]');
    await expect(chips.first()).toBeVisible();
    expect(await chips.count()).toBeGreaterThanOrEqual(1);
    await expect(page.locator('[data-testid="flora-sun-chip"]')).toContainText(
      /h · (Full sun|Partial shade|Shade)/,
    );

    // Accept the active candidate — one item placed, ring closes.
    await page.locator('[data-testid="flora-accept"]').click();
    const stats = page.locator("[data-gs-glass-card]").first();
    await expect(stats).toContainText("I1", { timeout: 10_000 });
    await expect(ring).toHaveCount(0);

    // No fatal console errors.
    const fatal = errors.filter(
      (e) =>
        e.includes("Maximum update depth") ||
        e.includes("TypeError") ||
        e.includes("ReferenceError"),
    );
    expect(fatal, `Fatal console errors:\n${fatal.join("\n")}`).toHaveLength(0);
  });
});
