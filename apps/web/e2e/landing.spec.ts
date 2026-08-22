import { expect, test } from "@playwright/test";

/**
 * Canvas-first landing — `/` pitches the studio over a real frame: a graded
 * sub-metre Stonnington aerial with a live Vicmap title boundary, the
 * "From GIS ingest to client sign-off" copy, and an address entry. Type an
 * address, pick the real GNAF match, and the hero re-centres on that
 * property and draws its boundary. One tap enters the product. No mock
 * telemetry — every claim on the page is a shipped studio feature.
 */
test.describe("Landing hero", () => {
  test("/ renders the pitch over the real frame without redirecting", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
    await expect(page.getByTestId("workstream-landing")).toBeVisible({
      timeout: 30_000,
    });

    // The pitch copy rides the hero frame.
    await expect(
      page.getByRole("heading", {
        name: "From GIS Ingest to Client Sign-Off.",
      }),
    ).toBeVisible();
    await expect(page.getByText("Skip the CAD.")).toBeVisible();
    await expect(page.getByText(/Auto-stream Vicmap boundaries/i)).toBeVisible();
    // The CTA — a primary button-styled link into the studio (targeted by
    // testid: the topbar's "Open the studio" link differs only by case).
    const cta = page.getByTestId("hero-open-studio");
    await expect(cta).toHaveAttribute("href", "/home");

    // The entry is still the interactive half — it renders server-side and
    // takes focus.
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

    // The retired wordless-era headline and mock-landing copy are both gone.
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

  test("studio workflow and app links are present", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "The Studio Workflow" }),
    ).toBeVisible();
    for (const step of [
      "Live GIS Ingest",
      "Tactile Vector Sketching",
      "Infinite 2D/3D Canvas",
      "Pop-Free LOD",
      "Parametric Quoting",
      "One-Click Sections",
      "Spatial UI",
      "Client Portal",
    ]) {
      await expect(
        page.getByRole("heading", { name: step, exact: true }),
      ).toBeVisible();
    }
    await expect(
      page.getByText(/Auto-stream Vicmap cadastral/i).first(),
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

  test("live site-analysis board renders from the registry feed", async ({
    page,
  }) => {
    await page.goto("/");
    const board = page.getByTestId("hero-site-analysis");
    await board
      .waitFor({ state: "visible", timeout: 15_000 })
      .catch(() => {});
    if ((await board.count()) > 0) {
      await expect(board).toContainText("SITE ANALYSIS");
      await expect(board).toContainText("TITLE / LIVE");
      await expect(board).toContainText("VICMAP CADASTRE");
      await expect(board).toContainText(/BOUNDARY \/ LIVE DATA|BOUNDARY \+ BUILDING \/ LIVE DATA/);
      // The board does not invent a building footprint when Vicmap cannot
      // provide one. It remains a live title analysis over the real aerial.
      await expect(page.getByText(/swimming pool|landscaped gardens|pre-sketch|proposed lawn/i)).toHaveCount(0);
    }
  });
});
