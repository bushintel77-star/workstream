import { expect, test } from "@playwright/test";
import {
  clickHeaderViewItem,
  createSurveyProject,
  handoffStudio,
} from "./helpers";

/**
 * Lane law — no two `[data-camera-chrome-card]` bboxes may intersect.
 * Covers schedule cards + right-lane panels across zoom / rotation.
 */

function boxesIntersect(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

async function assertNoCardOverlap(page: import("@playwright/test").Page) {
  const boxes = await page.evaluate(() => {
    const nodes = [
      ...document.querySelectorAll("[data-camera-chrome-card]"),
    ] as HTMLElement[];
    return nodes
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          testId: el.getAttribute("data-testid") ?? el.tagName,
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
        };
      })
      .filter((b) => b.width > 2 && b.height > 2);
  });

  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      expect(
        boxesIntersect(a, b),
        `overlap ${a.testId} ${JSON.stringify(a)} × ${b.testId} ${JSON.stringify(b)}`,
      ).toBe(false);
    }
  }
}

async function wheelZoom(
  page: import("@playwright/test").Page,
  deltaY: number,
) {
  const board = page.getByTestId("studio-board");
  await board.hover({ position: { x: 400, y: 280 } });
  await page.mouse.wheel(0, deltaY);
  await page.waitForTimeout(250);
}

test.describe("Lane law — chrome card overlap", () => {
  test("no schedule/panel card overlap at 3 zooms + rotated CAD", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("zoom-world")).toBeVisible({
      timeout: 15_000,
    });

    // Open layers (right lane) — must not sit under the tool tray.
    await clickHeaderViewItem(page, "canvas-layers-top");
    await expect(page.getByTestId("layers-panel")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("right-data-lane-layers")).toBeVisible();

    await clickHeaderViewItem(page, "pointer-settings-top");
    await expect(page.getByTestId("tool-dock")).toBeVisible({ timeout: 10_000 });
    const layersBox = await page.getByTestId("layers-panel").boundingBox();
    const dockBox = await page.getByTestId("tool-dock").boundingBox();
    expect(layersBox).toBeTruthy();
    expect(dockBox).toBeTruthy();
    if (layersBox && dockBox) {
      expect(layersBox.x).toBeGreaterThan(dockBox.x + dockBox.width);
    }

    /*
     * Diagnostic capture only — write to the gitignored artifacts dir.
     * `e2e/screenshots/` holds committed *input* fixtures (
     * sketch-image-layers.spec.ts loads cards-decluttered-night.png as its
     * sample upload), so writing run output there mutated another spec's
     * fixture and dirtied committed binaries on every run.
     */
    await page.screenshot({
      path: "e2e/artifacts/lane-law/layers-right-slot.png",
      fullPage: false,
    });

    await clickHeaderViewItem(page, "dark-canvas-top");

    await assertNoCardOverlap(page);
    await wheelZoom(page, 400);
    await assertNoCardOverlap(page);
    await wheelZoom(page, -800);
    await assertNoCardOverlap(page);

    const rotate = page.getByTestId("view-rot-cw");
    if (await rotate.isVisible().catch(() => false)) {
      await rotate.click();
      await page.waitForTimeout(300);
      await assertNoCardOverlap(page);
    }

    await page.screenshot({
      path: "e2e/artifacts/lane-law/cards-decluttered-night.png",
      fullPage: false,
    });

    // Live projects hide the demo Sites switcher (no seed-site leakage).
    await expect(page.getByTestId("canvas-sites-top")).toHaveCount(0);
    await expect(page.getByTestId("sites-popover")).toHaveCount(0);

    // Single right-lane occupant — closing layers frees the lane.
    await page.getByRole("button", { name: "Close layers" }).click();
    await expect(page.getByTestId("layers-panel")).toHaveCount(0);
  });
});
