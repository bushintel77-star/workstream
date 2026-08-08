import { expect, test } from "@playwright/test";

test.describe("Workstream landing", () => {
  test("minimal hero brands Workstream and enters the studio", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByTestId("workstream-landing")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("Workstream", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Garden design that starts on the site.",
      }),
    ).toBeVisible();

    await page.getByTestId("landing-enter-studio").click();
    await expect(page).toHaveURL(/\/home/);
    // Operator dashboard is Workstream-branded; Curtis & Co is portal/quote-only
    // (docs/EXTERNAL-DESIGNER-BRIEF.md §2 — do not mix brands).
    await expect(page.getByText("Workstream", { exact: true }).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("desktop viewport keeps one-composition landing", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await expect(page.getByTestId("workstream-landing")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("landing-enter-studio")).toBeVisible();
    // No project register chrome on the marketing face.
    await expect(page.locator("#new-project")).toHaveCount(0);
  });
});
