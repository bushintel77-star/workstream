import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  createSurveyProject,
  handoffStudio,
  expectToolDock,
  takeScreenshot,
} from "./helpers";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

test.describe("Selection focus veil", () => {
  test("veil docks above board, persists hop, click clears, chrome gate", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    const idA = randomUUID();
    const idB = randomUUID();
    const seed = await request.put(
      `${API}/projects/${projectId}/design-canvas`,
      {
        data: {
          placements: [
            {
              id: idA,
              symbol_id: "bluestone-paver",
              x_pct: 40,
              y_pct: 48,
              rotation_deg: 0,
              scale: 1,
            },
            {
              id: idB,
              symbol_id: "bluestone-paver",
              x_pct: 62,
              y_pct: 48,
              rotation_deg: 0,
              scale: 1,
            },
          ],
          strokes: [],
          irrigation_zones: [],
        },
      },
    );
    expect(seed.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}?svg=1&mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("cad-plan-board")).toHaveAttribute(
      "data-mode",
      "cad",
      { timeout: 15_000 },
    );
    await expectToolDock(page);

    await page.getByTestId("canvas-tool-select").click();
    const items = page.getByTestId("studio-item");
    await expect(items).toHaveCount(2, { timeout: 15_000 });
    await items.nth(0).dispatchEvent("pointerdown");
    await items.nth(0).dispatchEvent("pointerup");
    await expect(items.nth(0)).toHaveAttribute("data-selected", "true", {
      timeout: 5_000,
    });

    const veil = page.getByTestId("selection-focus-veil");
    await expect(veil).toBeVisible({ timeout: 5_000 });
    expect(
      await page
        .locator('[data-testid="zoom-world"] [data-testid="selection-focus-veil"]')
        .count(),
    ).toBe(0);
    expect(
      await page
        .locator('[data-testid="zoom-world"] [data-camera-chrome]')
        .count(),
    ).toBe(0);

    const modes = page.getByTestId("canvas-mode-strip");
    await expect(modes).toBeVisible();
    const modeOpacity = await modes.evaluate(
      (el) => getComputedStyle(el).opacity,
    );
    expect(Number(modeOpacity)).toBeGreaterThan(0.95);

    const honesty = page.locator('[class*="honestyCaption"]');
    if ((await honesty.count()) > 0) {
      const o = await honesty
        .first()
        .evaluate((el) => getComputedStyle(el).opacity);
      expect(Number(o)).toBeGreaterThan(0.95);
    }

    await takeScreenshot(page, "orbit-focus-veil");

    // Tree→tree hop — veil must stay mounted (no remount strobe).
    const veilHandle = await veil.elementHandle();
    expect(veilHandle).toBeTruthy();
    await items.nth(1).dispatchEvent("pointerdown");
    await items.nth(1).dispatchEvent("pointerup");
    await expect(items.nth(1)).toHaveAttribute("data-selected", "true", {
      timeout: 5_000,
    });
    await expect(veil).toBeVisible();
    const stillSame = await veil.evaluate(
      (el, prev) => el === prev,
      veilHandle,
    );
    expect(stillSame).toBe(true);

    // Click dimmed veil corner → deselect
    const box = await page.getByTestId("studio-board").boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.click(
      box!.x + box!.width * 0.08,
      box!.y + box!.height * 0.12,
    );
    await expect(veil).toHaveCount(0, { timeout: 5_000 });
    await expect(
      page.locator('[data-testid="studio-item"][data-selected="true"]'),
    ).toHaveCount(0);
  });
});
