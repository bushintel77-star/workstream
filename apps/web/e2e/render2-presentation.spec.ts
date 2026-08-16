import { expect, test } from "@playwright/test";
import {
  clickHeaderViewItem,
  createSurveyProject,
  handoffStudio,
  openCommandPalette,
  takeScreenshot,
} from "./helpers";

/**
 * Render 2 — presentation symbols, idle lens, annotations, LOD labels.
 * Artifacts: e2e/artifacts/camera-chrome-shots/render2-*.png
 */

test.describe("Render 2 presentation + annotations", () => {
  test("annotate happy path, labels, chrome detector, screenshots", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);

    await page.goto(`/projects/${projectId}?svg=1&mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("cad-plan-board")).toBeVisible({
      timeout: 15_000,
    });

    // Idle → presentation fidelity (symbols may appear after 600ms).
    await page.waitForTimeout(700);
    await expect(page.getByTestId("cad-plan-board")).toHaveAttribute(
      "data-fidelity",
      "presentation",
    );

    await openCommandPalette(page);
    await page.getByTestId("canvas-command-annotate").click();

    // Place anchor on plan centre
    const board = page.getByTestId("cad-plan-board");
    const box = await board.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.click(box!.x + box!.width * 0.55, box!.y + box!.height * 0.45);

    const input = page.getByTestId("annotate-input").locator("input");
    await expect(input).toBeVisible({ timeout: 5_000 });
    await input.fill("Retain existing gum");
    await input.press("Enter");

    // Demo seed may already paint notes — assert the note we just authored.
    const authored = page.getByTestId("annotation-note").filter({
      hasText: "Retain existing gum",
    });
    await expect(authored).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("annotation-leader").first()).toBeVisible();

    // Persist via save path, then reload
    await page.getByTestId("autosave-tick").click();
    await page.waitForTimeout(1200);
    await page.reload();
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(authored).toBeVisible({ timeout: 15_000 });

    // Zoom in until species labels may appear
    for (let i = 0; i < 8; i++) {
      await page.mouse.wheel(0, -180);
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(700);

    const labels = page.getByTestId("species-label");
    const labelCount = await labels.count();
    if (labelCount >= 2) {
      const b0 = await labels.nth(0).boundingBox();
      const b1 = await labels.nth(1).boundingBox();
      expect(b0 && b1).toBeTruthy();
      if (b0 && b1) {
        const overlapX =
          Math.min(b0.x + b0.width, b1.x + b1.width) - Math.max(b0.x, b1.x);
        const overlapY =
          Math.min(b0.y + b0.height, b1.y + b1.height) - Math.max(b0.y, b1.y);
        expect(overlapX <= 0 || overlapY <= 0).toBe(true);
      }
    }

    await takeScreenshot(page, "render2-presentation");

    // Fit sheet annotated
    await clickHeaderViewItem(page, "fit-sheet-top");
    await expect(page.getByTestId("fit-sheet-layer")).toBeVisible({
      timeout: 15_000,
    });
    await expect(authored).toBeVisible();
    await takeScreenshot(page, "render2-annotated-fit");

    // Gate C — no camera chrome inside zoom-world
    expect(
      await page
        .locator('[data-testid="zoom-world"] [data-camera-chrome]')
        .count(),
    ).toBe(0);
  });
});
