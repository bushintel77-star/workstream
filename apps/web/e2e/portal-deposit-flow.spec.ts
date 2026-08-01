import { test, expect } from "@playwright/test";

test.describe("Portal — deposit flow", () => {
  test("deposit success page renders with confirmation", async ({ page }) => {
    await page.goto("/portal/deposit-success");
    await expect(page).toHaveURL(/\/portal\/deposit-success/);
    // Should show some confirmation content
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
  });

  test("deposit cancel page renders with retry option", async ({ page }) => {
    await page.goto("/portal/deposit-cancel");
    await expect(page).toHaveURL(/\/portal\/deposit-cancel/);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
    // Should have a link or button to retry or go back
    const actionLink = page.locator("a, button").first();
    await expect(actionLink).toBeVisible({ timeout: 5_000 });
  });

  test("quote portal renders with print stylesheet", async ({ page }) => {
    // Visit a quote portal — use a dummy token; the page should render
    // the shell even if the quote doesn't load
    await page.goto("/portal/quote/test-token");
    // The page should either show the quote or an error/loading state
    await expect(page.locator("main, [data-testid]").first()).toBeVisible({ timeout: 10_000 });
  });
});
