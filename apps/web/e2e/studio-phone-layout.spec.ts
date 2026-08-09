import { expect, test } from "@playwright/test";
import {
  createSurveyProject,
  expectToolDock,
  handoffStudio,
  PHONE_STUDIO_VIEWPORT,
} from "./helpers";

/**
 * Adaptive phone shell — same HandoffDesignStudio engines, thumb chrome.
 * Desktop layout must remain the default at Desktop Chrome width.
 */
test.describe("Studio phone adaptive layout", () => {
  test("desktop viewport keeps data-layout=desktop and left tool dock", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/projects/${projectId}?mode=sketch`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(handoffStudio(page)).toHaveAttribute("data-layout", "desktop");
    await expectToolDock(page);

    const dock = page.getByTestId("tool-dock");
    const box = await dock.boundingBox();
    expect(box).toBeTruthy();
    // Left mid rail — dock sits in the left third of the viewport.
    expect(box!.x).toBeLessThan(200);
  });

  test("phone viewport switches chrome to bottom tools without nesting under zoom", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await page.setViewportSize(PHONE_STUDIO_VIEWPORT);
    await page.goto(`/projects/${projectId}?mode=sketch`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    // Layout arms from matchMedia after mount — poll until phone chrome sticks.
    await expect
      .poll(
        async () => await handoffStudio(page).getAttribute("data-layout"),
        { timeout: 15_000 },
      )
      .toBe("phone");
    await expectToolDock(page);
    await expect(page.getByTestId("zoom-world")).toBeVisible({ timeout: 15_000 });

    // Gate C — phone chrome still portals outside the camera.
    expect(
      await page.locator('[data-testid="zoom-world"] [data-camera-chrome]').count(),
    ).toBe(0);

    const dock = page.getByTestId("contextual-tool-strip");
    const board = page.getByTestId("studio-board");
    const dockBox = await dock.boundingBox();
    const boardBox = await board.boundingBox();
    expect(dockBox).toBeTruthy();
    expect(boardBox).toBeTruthy();
    // Bottom thumb strip — dock centre sits in the lower half of the board.
    expect(dockBox!.y + dockBox!.height / 2).toBeGreaterThan(
      boardBox!.y + boardBox!.height * 0.55,
    );

    // CompactModeNav — current mode chip + overflow (not the desktop full strip).
    await expect(page.getByTestId("canvas-mode-overflow")).toBeVisible();
    await expect(page.getByTestId("canvas-mode-sketch")).toBeVisible();
    await page.getByTestId("canvas-tool-select").click();
    await expect(page.getByTestId("canvas-tool-select")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
