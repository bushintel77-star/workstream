import { expect, test } from "@playwright/test";
import {
  clickHeaderViewItem,
  createSurveyProject,
  handoffStudio,
  takeScreenshot,
} from "./helpers";

test.describe("Sketch surfaces reconciliation", () => {
  test("plastic tray + dock undo; night dolphin; chrome gate", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await page.goto(`/projects/${projectId}?mode=sketch`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("sketch-board")).toBeVisible({
      timeout: 15_000,
    });

    const tray = page.getByTestId("sketch-convert-bar");
    await expect(tray).toBeVisible();
    await expect(page.getByTestId("sketch-pen")).toBeVisible();
    // Undo/Redo now live in the sketch dock, not a separate margin strip.
    await expect(page.getByTestId("sketch-undo-stroke")).toBeVisible();
    await expect(page.getByTestId("margin-strip")).toHaveCount(0);

    // No duplicate floating undo filmstrip in sketch
    await expect(page.getByTestId("undo-filmstrip")).toHaveCount(0);

    // Gate C — tray outside zoom-world
    expect(
      await page
        .locator('[data-testid="zoom-world"] [data-testid="sketch-convert-bar"]')
        .count(),
    ).toBe(0);
    expect(
      await page
        .locator('[data-testid="zoom-world"] [data-camera-chrome]')
        .count(),
    ).toBe(0);

    // Night — dolphin tokens, not hardcoded dark pills
    await clickHeaderViewItem(page, "dark-canvas-top");
    await expect(page.getByTestId("header-view-menu")).toHaveClass(
      /triggerActive|Active/,
      { timeout: 5_000 },
    );

    const penBg = await page.getByTestId("sketch-pen").evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, color: cs.color };
    });
    // Must not be near-black opaque pill (#241318 / rgb(36,19,24))
    expect(penBg.bg).not.toMatch(/rgba?\(36,\s*19,\s*24/);
    expect(penBg.bg).not.toMatch(/rgba?\(28,\s*25,\s*23/);

    await takeScreenshot(page, "night-sketch");
  });

  test("sketch enters on Select — drag grabs, Pen chip re-arms ink", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await page.goto(`/projects/${projectId}?mode=sketch`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    const pad = page.getByTestId("sketch-board");
    await expect(pad).toBeVisible({ timeout: 15_000 });

    // Ground state: Select armed, pad steps aside, cursor is a grab (not a pen).
    await expect(pad).toHaveAttribute("data-active", "false");
    const board = page.getByTestId("studio-board");
    await expect(board).toHaveCSS("cursor", "grab");

    // Plain left-drag pans the camera and lays no ink.
    const zoomWorld = page.getByTestId("zoom-world");
    const before = await zoomWorld.evaluate(
      (el) => getComputedStyle(el).transform,
    );
    const bb = await board.boundingBox();
    if (!bb) throw new Error("studio board has no bounding box");
    const cx = bb.x + bb.width / 2;
    const cy = bb.y + bb.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 90, cy + 60, { steps: 5 });
    await page.mouse.up();
    const after = await zoomWorld.evaluate(
      (el) => getComputedStyle(el).transform,
    );
    expect(after).not.toBe(before);
    expect(
      await page.locator('[data-testid="sketch-board"] svg path').count(),
    ).toBe(0);

    // Pen chip re-arms the pad — a drag now inks a stroke.
    await page.getByTestId("sketch-pen").click();
    await expect(pad).toHaveAttribute("data-active", "true");
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 60, cy + 40, { steps: 5 });
    await page.mouse.up();
    await expect(
      page.locator('[data-testid="sketch-board"] svg path'),
    ).toHaveCount(1);
  });
});
