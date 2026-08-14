import { expect, test } from "@playwright/test";

/**
 * Workstream landing — the "Acquire Site Truth" capture surface (0b1d03e).
 *
 * The marketing hero composition ("Garden design…", landing-enter-studio)
 * was replaced by the address-capture pipeline face; these tests pin the
 * CURRENT composition: one full-bleed canvas, the search HUD, the pipeline
 * + telemetry glass panels, and the address → confirm-pin entry flow.
 */
test.describe("Workstream landing", () => {
  test("site-truth surface renders and address entry enters the pipeline", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByTestId("workstream-landing")).toBeVisible({
      timeout: 30_000,
    });
    // The capture surface: search HUD + address composer.
    await expect(
      page.getByRole("heading", { name: "Acquire Site Truth" }),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Search site address" }),
    ).toBeVisible();
    // Pipeline + telemetry glass panels present (one composition, no chrome).
    await expect(
      page.getByRole("complementary", { name: "Pipeline status" }),
    ).toBeVisible();
    await expect(
      page.getByRole("complementary", { name: "Site telemetry" }),
    ).toBeVisible();

    // Entering an address moves into the pipeline (confirm-pin).
    const search = page.getByRole("combobox", { name: "Search site address" });
    await search.fill("1 Landing Spec Street, Prahran VIC 3181");
    const initiate = page.getByRole("button", { name: "Initiate" });
    await expect(initiate).toBeEnabled({ timeout: 10_000 });
    await initiate.click();
    await expect(page).toHaveURL(/\/confirm-pin/, { timeout: 30_000 });
  });

  test("desktop viewport keeps one-composition landing", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await expect(page.getByTestId("workstream-landing")).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByRole("heading", { name: "Acquire Site Truth" }),
    ).toBeVisible();
    // No project register chrome on the capture face.
    await expect(page.locator("#new-project")).toHaveCount(0);
  });
});
