import { expect, test } from "@playwright/test";

/**
 * Canvas-first landing — `/` is the marketing hero (no redirect): a real
 * sub-metre Stonnington aerial graded to dusk, the "Onsite sketch to fit
 * sheet." pitch, and an address CTA that deep-links into the operator
 * dashboard composer. The hero title polygon comes from the live Vicmap
 * feed and is asserted only when it lands (CI may lack upstream reach).
 */
test.describe("Landing hero", () => {
  test("/ renders the canvas-first hero without redirecting", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
    await expect(page.getByTestId("workstream-landing")).toBeVisible({
      timeout: 30_000,
    });
    // Server-painted copy — the first frame is never blank.
    await expect(
      page.getByRole("heading", { name: "Onsite sketch to fit sheet." }),
    ).toBeVisible();
    await expect(
      page.getByText(/pulled from the live Victorian cadastre/i).first(),
    ).toBeVisible();
    // Real aerial from the same keyless source as the survey canvas.
    const aerial = page.getByTestId("hero-aerial");
    await expect(aerial).toBeVisible();
    await expect(aerial).toHaveAttribute(
      "src",
      /services\.arcgisonline\.com/,
    );
    // The retired mock-landing copy must never resurface.
    await expect(
      page.getByRole("heading", { name: "Acquire Site Truth" }),
    ).toHaveCount(0);
  });

  test("address CTA deep-links into the dashboard composer", async ({
    page,
  }) => {
    await page.goto("/");
    const cta = page.getByRole("link", { name: "Enter your address" }).first();
    await expect(cta).toHaveAttribute("href", /\/home#new-project/);
    await cta.click();
    await expect(page).toHaveURL(/\/home#new-project/, { timeout: 30_000 });
    await expect(page.locator("#new-project")).toBeVisible({
      timeout: 30_000,
    });
  });

  test("flow steps and app links are present", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "One polygon, three moves." }),
    ).toBeVisible();
    for (const step of ["Title", "Sketch onsite", "Fit sheet"]) {
      await expect(
        page.getByRole("heading", { name: step, exact: true }),
      ).toBeVisible();
    }
    await expect(
      page.getByRole("link", { name: /Desktop app/ }),
    ).toHaveAttribute("href", "/home");
    await expect(
      page.getByText(/Mobile field app — EAS build/),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" }).first()).toHaveAttribute(
      "href",
      "/settings",
    );
  });

  test("live boundary overlay renders when the registry feed lands", async ({
    page,
  }) => {
    await page.goto("/");
    const boundary = page.getByTestId("hero-boundary");
    await boundary
      .first()
      .waitFor({ state: "visible", timeout: 15_000 })
      .catch(() => {});
    if ((await boundary.count()) > 0) {
      await expect(page.getByTestId("hero-boundary-status")).toHaveText(
        /live registry boundary/,
      );
    }
  });
});
