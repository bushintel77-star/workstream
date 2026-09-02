import { test, expect } from "@playwright/test";
import { createAddressProject } from "./helpers";

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
 * Error surfaces — scoped studio boundary vs app root.
 *
 * The home load-banner test was removed: /home now redirects signed-in
 * operators straight to their most recent project canvas (commit d305f26),
 * and the page fails open silently when listProjects throws — there is no
 * inline error banner to probe. The studio-scoped and app-root boundaries
 * remain and are tested below.
 */
test.describe("Error boundaries", () => {
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
