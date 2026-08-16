import { expect, test } from "@playwright/test";

/**
 * Demo garden smoke — the Tier-1 showcase route mounts the R3F canvas with
 * the physical-sky pipeline and settles without fatal console errors. A
 * screenshot lands in test-results/ on every run as the visual artifact.
 */
test.describe("Demo garden (Tier-1 render showcase)", () => {
  test("mounts the garden scene clean", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text().slice(0, 300));
    });
    page.on("pageerror", (e) => errors.push(`${e.name}: ${e.message.slice(0, 300)}`));

    await page.goto("/demo/garden");
    await expect(page.getByTestId("demo-garden")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator("canvas")).toBeVisible();
    // Sky capture + texture streaming + first composer frames.
    await page.waitForTimeout(5000);

    await page.screenshot({ path: "test-results/demo-garden.png" });

    const fatal = errors.filter(
      (e) =>
        e.includes("Maximum update depth") ||
        e.includes("TypeError") ||
        e.includes("ReferenceError"),
    );
    expect(fatal, `Fatal console errors:\n${fatal.join("\n")}`).toHaveLength(0);
  });
});
