import { expect, test } from "@playwright/test";
import { createSurveyProject, handoffStudio } from "./helpers";
import path from "node:path";
import fs from "node:fs";

const OUT = path.join(__dirname, "artifacts", "camera-chrome-shots");

test.describe("Sketch surfaces reconciliation", () => {
  test("plastic tray + margin strip; night dolphin; chrome gate", async ({
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
    await expect(page.getByTestId("margin-strip")).toBeVisible();
    await expect(page.getByTestId("sketch-undo-stroke")).toBeVisible();

    // No duplicate floating undo filmstrip in sketch
    await expect(page.getByTestId("undo-filmstrip")).toHaveCount(0);

    // Gate C — tray + strip outside zoom-world
    expect(
      await page
        .locator('[data-testid="zoom-world"] [data-testid="sketch-convert-bar"]')
        .count(),
    ).toBe(0);
    expect(
      await page
        .locator('[data-testid="zoom-world"] [data-testid="margin-strip"]')
        .count(),
    ).toBe(0);
    expect(
      await page
        .locator('[data-testid="zoom-world"] [data-camera-chrome]')
        .count(),
    ).toBe(0);

    // Night — dolphin tokens, not hardcoded dark pills
    await page.getByTestId("dark-canvas-top").click();
    await expect(page.getByTestId("dark-canvas-top")).toHaveClass(
      /iconBtnActive|Active/,
      { timeout: 5_000 },
    );

    const penBg = await page.getByTestId("sketch-pen").evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, color: cs.color };
    });
    // Must not be near-black opaque pill (#241318 / rgb(36,19,24))
    expect(penBg.bg).not.toMatch(/rgba?\(36,\s*19,\s*24/);
    expect(penBg.bg).not.toMatch(/rgba?\(28,\s*25,\s*23/);

    fs.mkdirSync(OUT, { recursive: true });
    const dest = path.join(OUT, "night-sketch.png");
    await page.screenshot({ path: dest, fullPage: false });
    expect(fs.existsSync(dest)).toBe(true);
  });
});
