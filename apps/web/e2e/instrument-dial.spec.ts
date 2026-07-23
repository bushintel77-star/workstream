import { expect, test } from "@playwright/test";
import { createSurveyProject, handoffStudio, expectToolDock } from "./helpers";
import path from "node:path";
import fs from "node:fs";

const OUT = path.join(__dirname, "artifacts", "camera-chrome-shots");

async function shot(
  page: import("@playwright/test").Page,
  name: string,
) {
  fs.mkdirSync(OUT, { recursive: true });
  const dest = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: dest, fullPage: false });
  if (!fs.existsSync(dest)) {
    throw new Error(`screenshot missing after write: ${dest}`);
  }
}

test.describe("Instrument reform — dock + selection dial", () => {
  test("single dock idle, dial rotate, tilt suppress, chrome gate", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("cad-plan-board")).toBeVisible({
      timeout: 15_000,
    });

    await expectToolDock(page);
    await shot(page, "dock-consolidated");

    // Demolition — old clusters gone
    await expect(page.getByTestId("ambient-ribbon")).toHaveCount(0);
    await expect(page.getByTestId("instrument-hub")).toHaveCount(0);
    await expect(page.getByTestId("instrument-carousel")).toHaveCount(0);

    // Pan, then select a seed / placed studio item
    await page.getByTestId("canvas-tool-pan").click();
    let item = page.getByTestId("studio-item").first();
    if ((await item.count()) === 0) {
      // Empty canvas — place a canopy via Add + kit
      await page.getByTestId("canvas-tool-add").click();
      const trees = page.getByTestId("kit-dock-tab-trees");
      if (await trees.isVisible().catch(() => false)) await trees.click();
      const canopy = page.getByTestId("paint-swatch-canopy");
      await expect(canopy).toBeVisible({ timeout: 5_000 });
      await canopy.click();
      const board = page.getByTestId("cad-plan-board");
      const box = await board.boundingBox();
      expect(box).toBeTruthy();
      await page.mouse.click(
        box!.x + box!.width * 0.55,
        box!.y + box!.height * 0.5,
      );
      await page.getByTestId("canvas-tool-pan").click();
      item = page.getByTestId("studio-item").first();
    }
    await expect(item).toBeVisible({ timeout: 8_000 });
    // TPZ hit overlay can steal pointer at the item centre — dispatch on the
    // item node so CadPlanBoard's onPointerDown still selects.
    await item.dispatchEvent("pointerdown");
    await item.dispatchEvent("pointerup");
    await page.waitForTimeout(200);

    const dial = page.getByTestId("selection-dial");
    await expect(dial).toBeVisible({ timeout: 8_000 });

    // Dial must NOT live under zoom-world (Gate C portal)
    expect(
      await page
        .locator('[data-testid="zoom-world"] [data-testid="selection-dial"]')
        .count(),
    ).toBe(0);

    await shot(page, "dial-open");

    const rotateSlot = page.getByTestId("dial-slot-rotate");
    await expect(rotateSlot).toBeVisible();
    const rbox = await rotateSlot.boundingBox();
    expect(rbox).toBeTruthy();
    await page.mouse.move(rbox!.x + rbox!.width / 2, rbox!.y + rbox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      rbox!.x + rbox!.width / 2 + 48,
      rbox!.y + rbox!.height / 2 - 24,
      { steps: 10 },
    );
    await page.mouse.up();
    await page.waitForTimeout(200);

    // Esc dismisses dial (clears selection)
    await page.keyboard.press("Escape");
    await expect(dial).toHaveCount(0);

    // Re-select and tilt — dial must not render while tilted
    await item.dispatchEvent("pointerdown");
    await item.dispatchEvent("pointerup");
    await expect(page.getByTestId("selection-dial")).toBeVisible({
      timeout: 5_000,
    });
    await page.getByTestId("canvas-command-top").click();
    const tiltCmd = page.getByTestId("canvas-command-tilt-view");
    if (await tiltCmd.isVisible().catch(() => false)) {
      await tiltCmd.click();
      await page.waitForTimeout(600);
      await expect(page.getByTestId("selection-dial")).toHaveCount(0);
      await page.keyboard.press("Escape");
    }

    expect(
      await page
        .locator('[data-testid="zoom-world"] [data-camera-chrome]')
        .count(),
    ).toBe(0);
  });
});
