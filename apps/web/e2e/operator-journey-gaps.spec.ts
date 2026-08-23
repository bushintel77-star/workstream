import { test, expect } from "@playwright/test";
import { createAddressProject, waitForApiReady } from "./helpers";

/**
 * First-create locate loader — walks the full confirm-pin animation into the
 * WebGL studio. Closes the gap called out in OPERATOR-UX-WORKFLOW §Stage 3.
 */
test.describe("Confirm-pin locate loader", () => {
  test.setTimeout(120_000);

  test("loader reaches the studio with guide flag", async ({ page }) => {
    const address = "6 Beatty Ave, Armadale VIC 3143";
    const lat = -37.8558;
    const lng = 145.0123;
    const params = new URLSearchParams({
      address,
      lat: String(lat),
      lng: String(lng),
    });

    await page.goto(`/confirm-pin?${params.toString()}`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByTestId("locate-loader-stage")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("locate-loader-aerial")).toBeVisible();

    await expect(page).toHaveURL(/\/projects\/[^/?]+(\?guide=1|$)/, {
      timeout: 90_000,
    });
    await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("The drawing hit an error.")).toHaveCount(0);
  });
});

/**
 * Operator dashboard address composer — UI path into confirm-pin (not API seed).
 */
test.describe("Home address composer", () => {
  test.setTimeout(60_000);

  test("composer navigates to confirm-pin", async ({ page, request }) => {
    await waitForApiReady(request);

    await page.goto("/home", { waitUntil: "networkidle" });
    await expect(page.getByLabel("Project address")).toBeVisible({
      timeout: 15_000,
    });

    const input = page.getByLabel("Project address");
    await input.fill("6 Beatty Ave Armadale");

    const options = page.locator('[role="option"]');
    await options
      .first()
      .waitFor({ state: "visible", timeout: 12_000 })
      .catch(() => {});

    if ((await options.count()) > 0) {
      await options.first().click();
    } else {
      await page.getByRole("button", { name: "Locate property →" }).click();
    }

    await expect(page).toHaveURL(/\/confirm-pin\?/, { timeout: 30_000 });
    await expect(page.getByTestId("locate-loader-stage")).toBeVisible({
      timeout: 15_000,
    });
  });
});

/**
 * Error surfaces — inline home banner vs scoped studio boundary vs app root.
 */
test.describe("Error boundaries", () => {
  test("home shows inline load banner, not the app crash page", async ({
    page,
  }) => {
    await page.goto("/home?e2eLoadError=1", { waitUntil: "networkidle" });
    await expect(page.getByTestId("home-load-error")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Could not load projects")).toBeVisible();
    await expect(page.getByText("That didn't land.")).toHaveCount(0);
    await expect(page.getByLabel("Project address")).toBeVisible();
  });

  test("studio route renders scoped error copy", async ({ page, request }) => {
    const { projectId } = await createAddressProject(request, {
      address: "9 Error Boundary Street, Melbourne VIC 3000",
    });

    await page.goto(`/projects/${projectId}?e2eStudioError=1`, {
      waitUntil: "networkidle",
    });

    await expect(page.getByText("The drawing hit an error.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "Reopen studio" })).toBeVisible();
    await expect(page.getByText("That didn't land.")).toHaveCount(0);
  });

  test("app root boundary renders global copy", async ({ page }) => {
    await page.goto("/e2e/root-error", { waitUntil: "networkidle" });
    await expect(page.getByText("That didn't land.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByText("The drawing hit an error.")).toHaveCount(0);
  });
});
