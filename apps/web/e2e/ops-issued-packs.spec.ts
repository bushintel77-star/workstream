import { test, expect } from "@playwright/test";
import {
  createSurveyProject,
  handoffStudio,
  openCommandPalette,
} from "./helpers";

/**
 * Issued documentation packs must be visible and re-downloadable.
 *
 * Before this, "Issue documentation pack" minted a brand-new pack on every
 * click and streamed its zip once. `GET /documentation-packages` had been
 * listing them the whole time with nothing consuming it, so an already-issued
 * deliverable was invisible and the only way to get the file again was to issue
 * a duplicate.
 */
test.describe("Ops schedules — issued documentation packs", () => {
  test("issuing a pack lists it for re-download", async ({ page, request }) => {
    const { projectId } = await createSurveyProject(request);
    await page.goto(`/projects/${projectId}?svg=1&mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });

    await openCommandPalette(page);
    await page.getByLabel("Search assets").fill("ops schedules");
    await page.getByTestId("canvas-command-ops-schedules").click();
    await expect(page.getByTestId("ops-schedules-dock")).toBeVisible({
      timeout: 15_000,
    });

    // Nothing issued yet — the list stays absent rather than parking an empty
    // shell in the dock.
    await expect(page.getByTestId("ops-issued-packs")).toHaveCount(0);

    // Issuing streams the zip into a new tab; adopt and close the popup so it
    // cannot leave a pending download holding the test open.
    const popup = page.waitForEvent("popup").catch(() => null);
    await page.getByTestId("ops-schedule-issue-pack").click();
    const opened = await popup;
    await opened?.close().catch(() => undefined);

    const packs = page.getByTestId("ops-issued-packs");
    await expect(packs).toBeVisible({ timeout: 15_000 });

    const rows = packs.locator("li");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Issued");

    // The re-download points at that pack's own zip — not a fresh mint.
    const href = await packs.locator("a").first().getAttribute("href");
    expect(href).toMatch(
      new RegExp(
        `^/api/projects/${projectId}/documentation-packages/[0-9a-f-]{36}/zip$`,
      ),
    );
  });
});
