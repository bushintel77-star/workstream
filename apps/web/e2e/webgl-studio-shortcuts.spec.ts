import { test, expect } from "@playwright/test";
import { createAddressProject } from "./helpers";

test.describe("WebGL studio keyboard map", () => {
  test("? opens the shortcut list; A opens the asset library", async ({
    page,
    request,
  }) => {
    const { projectId } = await createAddressProject(request, {
      address: "1 Shortcut Street, Melbourne VIC 3000",
    });
    await page.goto(`/projects/${projectId}?webgl=1`, {
      waitUntil: "networkidle",
    });
    await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
      timeout: 15_000,
    });

    await page.keyboard.press("?");
    const help = page.locator('[data-testid="studio-shortcuts-help"]');
    await expect(help).toBeVisible({ timeout: 5_000 });
    await expect(help).toContainText("SHORTCUTS");
    await expect(help).toContainText("Shift+2");
    await page.locator('[data-testid="studio-shortcuts-close"]').click();
    await expect(help).toHaveCount(0);

    await page.keyboard.press("a");
    const library = page.locator('[data-testid="asset-library"]');
    await expect(library).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[data-testid="asset-filter-all"]')).toBeVisible();
    await expect(page.locator('[data-testid="asset-search"]')).toBeVisible();
  });
});
