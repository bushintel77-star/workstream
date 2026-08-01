import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import {
  createSurveyProject,
  handoffStudio,
  expectToolDock,
  takeScreenshot,
} from "./helpers";

const API = process.env.API_URL ?? "http://localhost:3001";

test.describe("Instrument reform — dock + selection dial", () => {
  test("single dock idle, dial rotate, tilt suppress, chrome gate", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);

    // Seed a hardscape placement (no TPZ overlay stealing the click).
    const seed = await request.put(
      `${API}/projects/${projectId}/design-canvas`,
      {
        data: {
          placements: [
            {
              id: randomUUID(),
              symbol_id: "bluestone-paver",
              x_pct: 48,
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

    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("cad-plan-board")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("cad-plan-board")).toHaveAttribute(
      "data-mode",
      "cad",
      { timeout: 15_000 },
    );

    await expectToolDock(page);
    await takeScreenshot(page, "dock-consolidated");

    // Demolition — old clusters gone
    await expect(page.getByTestId("ambient-ribbon")).toHaveCount(0);
    await expect(page.getByTestId("instrument-hub")).toHaveCount(0);
    await expect(page.getByTestId("instrument-carousel")).toHaveCount(0);

    await page.getByTestId("canvas-tool-select").click();
    const item = page.getByTestId("studio-item").first();
    await expect(item).toBeVisible({ timeout: 15_000 });
    await item.click();
    await expect(item).toHaveAttribute("data-selected", "true", {
      timeout: 5_000,
    });

    const dial = page.getByTestId("selection-dial");
    await expect(dial).toBeVisible({ timeout: 8_000 });

    // Dial must NOT live under zoom-world (Gate C portal)
    expect(
      await page
        .locator('[data-testid="zoom-world"] [data-testid="selection-dial"]')
        .count(),
    ).toBe(0);

    await takeScreenshot(page, "dial-open");

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
    await item.click();
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
