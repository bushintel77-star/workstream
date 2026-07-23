import { expect, test } from "@playwright/test";
import {
  createSurveyProject,
  expectToolDock,
  handoffStudio,
} from "./helpers";

/**
 * The left tool dock is itself the carousel — a curved frost rail + slots
 * on a C-arc — not a fixed rectangle with only chip-guts transformed.
 */
test.describe("Tool dock carousel shell", () => {
  test("rail shell curves; crest slot leans toward the board", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expectToolDock(page);

    const dock = page.getByTestId("tool-dock");
    await expect(dock).toHaveAttribute("data-carousel", "1");
    await expect(page.getByTestId("tool-dock-rail")).toBeVisible();

    // Rest crest follows the active tool (Pan on CAD idle) — lean > 0.
    const restLean = await page.evaluate(() => {
      const slots = Array.from(
        document.querySelectorAll('[data-testid="tool-dock-slot"]'),
      ) as HTMLElement[];
      const crest = slots.find((s) => s.getAttribute("data-crest") === "1");
      if (!crest) return 0;
      return Number.parseFloat(
        getComputedStyle(crest).getPropertyValue("--dock-lean"),
      );
    });
    expect(restLean).toBeGreaterThan(8);

    // Hover near the top — crest travels; Trace/Edit region leans hard.
    const box = await dock.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box!.x + 20, box!.y + 36);
    await page.waitForTimeout(180);

    const after = await page.evaluate(() => {
      const slots = Array.from(
        document.querySelectorAll('[data-testid="tool-dock-slot"]'),
      ) as HTMLElement[];
      return slots.map((s) =>
        Number.parseFloat(
          getComputedStyle(s).getPropertyValue("--dock-lean") || "0",
        ),
      );
    });
    expect(after[0]!).toBeGreaterThan(8);
    // Far end of the arc must stay near the rest floor.
    expect(after[after.length - 1]!).toBeLessThan(4);

    // Gate C — dock chrome stays outside the camera.
    expect(
      await page
        .locator('[data-testid="zoom-world"] [data-camera-chrome]')
        .count(),
    ).toBe(0);
  });
});
