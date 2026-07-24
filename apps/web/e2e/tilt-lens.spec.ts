import { expect, test } from "@playwright/test";
import {
  createSurveyProject,
  handoffStudio,
  openCommandPalette,
} from "./helpers";
import path from "node:path";
import fs from "node:fs";

/**
 * Tilt lens — view-only axonometric preview.
 * Must keep gate C (zero data-camera-chrome under zoom-world).
 */

const OUT = path.join(__dirname, "artifacts", "camera-chrome-shots");

async function shot(page: import("@playwright/test").Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({
    path: path.join(OUT, `${name}.png`),
    fullPage: false,
  });
}

test.describe("Tilt lens", () => {
  test("chrome gate, no-edit while tilted, Esc exits, ctrl-drag snaps", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("zoom-world")).toBeVisible({
      timeout: 15_000,
    });

    await shot(page, "tilt-off");

    await openCommandPalette(page);
    await page.getByTestId("canvas-command-tilt-view").click();
    await expect(page.getByTestId("studio-board")).toHaveAttribute(
      "data-tilt",
      "1",
      { timeout: 5_000 },
    );

    expect(
      await page
        .locator('[data-testid="zoom-world"] [data-camera-chrome]')
        .count(),
    ).toBe(0);

    await shot(page, "tilt-on");

    await expect(page.getByTestId("tilt-skin")).toBeVisible();
    await expect(page.getByTestId("parchment-bleed")).toHaveCount(0);

    const board = page.getByTestId("cad-plan-board");
    const box = await board.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(
      box!.x + box!.width * 0.4,
      box!.y + box!.height * 0.4,
    );
    await page.mouse.down();
    await page.mouse.move(
      box!.x + box!.width * 0.55,
      box!.y + box!.height * 0.55,
      { steps: 8 },
    );
    await page.mouse.up();
    await expect(
      page.locator('[data-testid="studio-item"][data-selected="true"]'),
    ).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("studio-board")).toHaveAttribute(
      "data-tilt",
      "0",
      { timeout: 3_000 },
    );
    await expect(page.getByTestId("tilt-skin")).toHaveCount(0);
    await expect(page.getByTestId("parchment-bleed")).toBeVisible();

    await page.keyboard.down("Control");
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(
      box!.x + box!.width / 2,
      box!.y + box!.height * 0.34,
      { steps: 3 },
    );
    await page.mouse.up();
    await page.keyboard.up("Control");
    await expect(page.getByTestId("studio-board")).toHaveAttribute(
      "data-tilt",
      "0",
      { timeout: 3_000 },
    );

    await page.keyboard.down("Control");
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height * 0.2);
    await page.mouse.down();
    await page.mouse.move(
      box!.x + box!.width / 2,
      box!.y + box!.height * 0.6,
      { steps: 12 },
    );
    await page.mouse.up();
    await page.keyboard.up("Control");
    await expect(page.getByTestId("studio-board")).toHaveAttribute(
      "data-tilt",
      "1",
      { timeout: 3_000 },
    );

    expect(
      await page
        .locator('[data-testid="zoom-world"] [data-camera-chrome]')
        .count(),
    ).toBe(0);
  });
});
