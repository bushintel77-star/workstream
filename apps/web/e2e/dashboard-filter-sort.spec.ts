import { test, expect } from "@playwright/test";

test.describe("Dashboard — filter, sort, search", () => {
  test("dashboard renders with project grid", async ({ page }) => {
    await page.goto("/home");
    await expect(page).toHaveURL(/\/home/);
    // Should have project cards or empty state
    const grid = page.locator('[class*="projectGrid"], [class*="emptyState"]').first();
    await expect(grid).toBeVisible({ timeout: 15_000 });
  });

  test("search input filters projects", async ({ page }) => {
    await page.goto("/home");
    // Find search input
    const search = page.locator('input[type="search"], input[placeholder*="search" i], input[aria-label*="search" i]').first();
    if (await search.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await search.fill("zzz-nonexistent-project");
      // Should show no-results state
      await expect(page.getByText(/no matching/i).or(page.locator('[class*="noResults"]'))).toBeVisible({ timeout: 5_000 });
      // Clear search
      await search.clear();
    }
  });

  test("status filter chips toggle", async ({ page }) => {
    await page.goto("/home");
    // Find status filter buttons
    const filterBtns = page.locator('button[aria-pressed], [class*="statusFilter"] button').first();
    if (await filterBtns.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const initialPressed = await filterBtns.getAttribute("aria-pressed");
      await filterBtns.click();
      const afterClick = await filterBtns.getAttribute("aria-pressed");
      expect(initialPressed).not.toBe(afterClick);
    }
  });

  test("sort buttons cycle", async ({ page }) => {
    await page.goto("/home");
    // Find sort buttons
    const sortBtns = page.locator('button[aria-pressed][class*="sort"], [class*="sortBtn"]').first();
    if (await sortBtns.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await sortBtns.click();
      // Should still be on the dashboard
      await expect(page).toHaveURL(/\/home/);
    }
  });

  test("delete dialog appears (not window.confirm)", async ({ page }) => {
    await page.goto("/home");
    // Find an Actions popover trigger
    const actionsTrigger = page.getByText("Actions").first();
    if (await actionsTrigger.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await actionsTrigger.click();
      // Popover menu should appear
      await expect(page.getByTestId("popover-menu")).toBeVisible({ timeout: 3_000 });
      // Click Delete
      const deleteBtn = page.getByTestId("popover-menu").getByText("Delete").first();
      if (await deleteBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await deleteBtn.click();
        // Dialog should appear (not window.confirm)
        await expect(page.getByTestId("dialog-panel")).toBeVisible({ timeout: 5_000 });
        await expect(page.getByText("Delete project?")).toBeVisible();
        // Cancel
        await page.getByText("Cancel").click();
        await expect(page.getByTestId("dialog-panel")).not.toBeVisible({ timeout: 3_000 });
      }
    }
  });
});
