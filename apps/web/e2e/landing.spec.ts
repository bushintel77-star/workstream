import { expect, test } from "@playwright/test";

/**
 * Root entry — the marketing landing ("Acquire Site Truth") was removed
 * (it presented mock telemetry as live data). `/` now enters the operator
 * dashboard directly, where the address composer + site-truth pipeline run
 * against real API data.
 */
test.describe("Root entry", () => {
  test("/ redirects into the operator dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/home/, { timeout: 30_000 });
    // The real capture surface lives on the dashboard: the address composer.
    await expect(page.locator("#new-project")).toBeVisible({
      timeout: 30_000,
    });
    // Zero-mock-data law: the fabricated landing chrome is gone.
    await expect(page.getByTestId("workstream-landing")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Acquire Site Truth" }),
    ).toHaveCount(0);
  });
});
