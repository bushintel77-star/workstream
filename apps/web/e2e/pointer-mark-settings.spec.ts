import { test, expect } from "@playwright/test";
import {
  createSurveyProject,
  handoffStudio,
  openCommandPalette,
} from "./helpers";

/**
 * Runtime probe for the pointer-mark sheet.
 *
 * `scripts/check-feature-reachability.mjs` can only see that the component is
 * imported and tagged — it explicitly cannot see one that is mounted behind a
 * condition which is never true. This spec is that missing check: it drives the
 * Cmd+K entry, asserts the sheet really paints, that its choice persists, and
 * that it portals outside the camera (gate B).
 */
test.describe("Pointer mark settings", () => {
  test("Cmd+K summons the sheet; the chosen mark persists", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await page.goto(`/projects/${projectId}?svg=1&mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });

    // Degrades invisibly — dormant state carries no idle chrome (§6 item 11).
    await expect(page.getByTestId("pointer-mark-settings")).toHaveCount(0);

    await openCommandPalette(page);
    await page.getByLabel("Search assets").fill("pointer mark");
    await page.getByTestId("canvas-command-pointer-settings").click();

    const panel = page.getByTestId("pointer-mark-settings");
    await expect(panel).toBeVisible({ timeout: 10_000 });

    // Gate B — frosted chrome must never live inside the camera.
    await expect(
      page.locator(
        '[data-testid="zoom-world"] [data-testid="pointer-mark-settings"]',
      ),
    ).toHaveCount(0);

    // Spade is the default kept mark.
    await expect(page.getByTestId("pointer-mark-spade")).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // Click-to-keep moves the selection.
    await page.getByTestId("pointer-mark-fork").click();
    await expect(page.getByTestId("pointer-mark-fork")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByTestId("pointer-mark-spade")).toHaveAttribute(
      "aria-selected",
      "false",
    );

    await panel.getByRole("button", { name: "Close settings" }).click();
    await expect(panel).toHaveCount(0);

    // Persisted, not just held in component state.
    await page.reload();
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await openCommandPalette(page);
    await page.getByLabel("Search assets").fill("pointer mark");
    await page.getByTestId("canvas-command-pointer-settings").click();
    await expect(page.getByTestId("pointer-mark-settings")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("pointer-mark-fork")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
