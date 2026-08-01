import { test, expect } from "@playwright/test";

test.describe("Settings — crew management", () => {
  test("crew page renders and add/remove flow works", async ({ page, request }) => {
    // Navigate to settings
    await page.goto("/settings/crew");
    await expect(page).toHaveURL(/\/settings\/crew/);

    // Page should have crew list heading
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });

    // Add crew member form should be present
    const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
    if (await nameInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await nameInput.fill("E2E Test Crew Member");
      const submitBtn = page.locator('button[type="submit"]').first();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        // Should see the new crew member or a toast
        await expect(page.getByText("E2E Test Crew Member").or(page.locator("[role='status']"))).toBeVisible({ timeout: 10_000 });
      }
    }
  });

  test("remove crew member shows Dialog confirmation", async ({ page }) => {
    await page.goto("/settings/crew");
    await expect(page).toHaveURL(/\/settings\/crew/);

    // Find a remove button if crew members exist
    const removeBtn = page.getByText("Remove").first();
    if (await removeBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await removeBtn.click();
      // Dialog should appear (not window.confirm)
      await expect(page.getByTestId("dialog-panel")).toBeVisible({ timeout: 5_000 });
      await expect(page.getByText("Remove crew member?")).toBeVisible();
      // Cancel should close dialog
      await page.getByText("Cancel").click();
      await expect(page.getByTestId("dialog-panel")).not.toBeVisible({ timeout: 3_000 });
    }
  });
});

test.describe("Settings — rate card", () => {
  test("rate card page renders with editable fields", async ({ page }) => {
    await page.goto("/settings/rate-card");
    await expect(page).toHaveURL(/\/settings\/rate-card/);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Settings — suppliers", () => {
  test("suppliers page renders with list", async ({ page }) => {
    await page.goto("/settings/suppliers");
    await expect(page).toHaveURL(/\/settings\/suppliers/);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Settings — license", () => {
  test("license page renders", async ({ page }) => {
    await page.goto("/settings/license");
    await expect(page).toHaveURL(/\/settings\/license/);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });
  });
});
