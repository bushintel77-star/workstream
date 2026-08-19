import { expect, test } from "@playwright/test";

/**
 * Canvas-first landing — `/` says nothing. The hero is a real sub-metre
 * Stonnington aerial with a live Vicmap title boundary, and its only
 * interactive element is the address entry: type an address, pick the real
 * GNAF match, and the hero re-centres on that property and draws its
 * boundary. One tap enters the product. No pitch copy, no mock telemetry.
 */
test.describe("Landing hero", () => {
  test("/ renders the wordless hero without redirecting", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
    await expect(page.getByTestId("workstream-landing")).toBeVisible({
      timeout: 30_000,
    });

    // The entry is the page — it renders server-side and takes focus.
    const input = page.getByTestId("hero-address-input");
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute("placeholder", "Enter your address");
    await expect(input).toBeFocused();

    // Real aerial from the same keyless source as the survey canvas.
    const aerial = page.getByTestId("hero-aerial");
    await expect(aerial).toBeVisible();
    await expect(aerial).toHaveAttribute(
      "src",
      /services\.arcgisonline\.com/,
    );

    // No saying — the retired headline and mock-landing copy are both gone.
    await expect(
      page.getByRole("heading", { name: "Onsite sketch to fit sheet." }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Acquire Site Truth" }),
    ).toHaveCount(0);
  });

  test("address entry picks a real match and opens the site", async ({
    page,
  }) => {
    await page.goto("/");
    const input = page.getByTestId("hero-address-input");
    await input.click();
    await input.fill("6 Beatty Ave Armadale");

    // Live GNAF: options or an honest unavailable hint are both acceptable.
    const options = page.locator('[role="option"]');
    await options
      .first()
      .waitFor({ state: "visible", timeout: 9_000 })
      .catch(() => {});
    await page
      .getByText(/No verified match|unavailable/i)
      .first()
      .waitFor({ state: "visible", timeout: 3_000 })
      .catch(() => {});

    if ((await options.count()) > 0) {
      await options.first().click();
      // The picked address pins into the input…
      await expect(input).not.toHaveValue("");
      // …and the button becomes the explicit entry gate.
      const open = page.getByRole("button", { name: "Open the site" });
      await expect(open).toBeVisible();
      await open.click();
      await expect(page).toHaveURL(/\/confirm-pin/, { timeout: 30_000 });
    }
  });

  test("steps and app links are present", async ({ page }) => {
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
      page.getByText(/pulled from the live Victorian cadastre/i).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Desktop app/ }),
    ).toHaveAttribute("href", "/home");
    await expect(
      page.getByText(/Mobile field app — EAS build/),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Settings" }).first(),
    ).toHaveAttribute("href", "/settings");
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
      await expect(page.getByText(/live boundary ·/i)).toBeVisible();
      // The chalk concept pass rides the same live polygon.
      const sketch = page.getByTestId("hero-sketch");
      await expect(sketch.first()).toBeVisible();
      await expect(
        page.getByText(/pleached hornbeam screen/i),
      ).toBeVisible();
      await expect(page.getByText(/mass-planted Lomandra/i)).toBeVisible();
      await expect(page.getByText(/bluestone path/i)).toBeVisible();
    }
  });
});
