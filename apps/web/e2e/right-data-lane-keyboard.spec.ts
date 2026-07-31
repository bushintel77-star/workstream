import { expect, test } from "@playwright/test";
import { createSurveyProject, handoffStudio } from "./helpers";

/**
 * RightDataLane (Layers / Measures / Services / Checklist / Sites / Trees /
 * Site / Environment / Ghosts) owns one shared keyboard contract: Esc closes
 * the lane, and Tab/Shift+Tab trap focus inside it while open. See
 * features/surfaces/DataLaneSlot.tsx.
 */
test.describe("Right data lane keyboard contract", () => {
  test("Escape closes the survey checklist lane", async ({ page, request }) => {
    const { projectId } = await createSurveyProject(request);
    await page.goto(`/projects/${projectId}?mode=survey`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });

    const lane = page.getByTestId("right-data-lane-checklist");
    await expect(lane).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("survey-checklist")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(lane).toHaveCount(0);
  });

  test("Tab wraps focus inside the checklist lane while open", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await page.goto(`/projects/${projectId}?mode=survey`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });

    const lane = page.getByTestId("right-data-lane-checklist");
    await expect(lane).toBeVisible({ timeout: 15_000 });

    // Focus should land inside the lane on open (first focusable, or the
    // lane itself if nothing is focusable yet).
    const focusedInLane = await page.evaluate(() => {
      const lane = document.querySelector(
        '[data-testid="right-data-lane-checklist"]',
      );
      return Boolean(lane && lane.contains(document.activeElement));
    });
    expect(focusedInLane).toBe(true);

    // Shift+Tab from the first focusable wraps to the last, not out to the canvas.
    await page.keyboard.press("Shift+Tab");
    const stillInLane = await page.evaluate(() => {
      const lane = document.querySelector(
        '[data-testid="right-data-lane-checklist"]',
      );
      return Boolean(lane && lane.contains(document.activeElement));
    });
    expect(stillInLane).toBe(true);
  });
});
