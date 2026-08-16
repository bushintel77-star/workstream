import { expect, test } from "@playwright/test";
import { createSurveyProject, handoffStudio } from "./helpers";

/**
 * Tier1TopBar responsive contract — viewport widths under 1280px.
 *
 * Regression guard for the sub-1280 header pass: the centered mode strip
 * used to overflow its scroll zone leftward (unreachable, colliding with
 * the lifecycle phase widget). The strip now start-aligns under pressure
 * and stays fully inside the center zone; below 1280 the density pass
 * (phase label dropped, cadastral meta hidden, tighter tab padding) keeps
 * the eight tabs fitting beside the phase widget.
 */
const WIDTHS = [1180, 1080, 980] as const;

test.describe("Studio header responsive (sub-1280)", () => {
  for (const width of WIDTHS) {
    test(`mode strip stays clear of the phase widget at ${width}px`, async ({
      page,
      request,
    }) => {
      const { projectId } = await createSurveyProject(request);
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/projects/${projectId}?svg=1&mode=cad`);
      await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("tier1-top-bar")).toBeVisible();

      const zones = page.locator('[data-testid="tier1-top-bar"] > div');
      const center = zones.nth(1);
      const phase = page.getByTestId("phase-manager-toggle");
      const firstTab = page.getByTestId("canvas-mode-survey");
      const lastTab = page.getByTestId("canvas-mode-share");

      // The strip never escapes the center zone toward the phase widget:
      // every tab's left edge sits at or inside the zone's content box.
      const centerBox = await center.boundingBox();
      const firstBox = await firstTab.boundingBox();
      expect(centerBox, "center zone measurable").toBeTruthy();
      expect(firstBox, "first mode tab measurable").toBeTruthy();
      expect(
        firstBox!.x,
        "first tab must not start left of the center zone (unreachable overflow)",
      ).toBeGreaterThanOrEqual(centerBox!.x);

      // No horizontal overlap between the phase widget and any mode tab.
      const phaseBox = await phase.boundingBox();
      await expect(phaseBox, "phase widget present below 1280").toBeTruthy();
      expect(phaseBox!.x + phaseBox!.width).toBeLessThanOrEqual(firstBox!.x);

      // The whole strip is reachable: scrolling the zone to the end brings
      // the last tab fully inside the visible band.
      await page.evaluate(() => {
        const zone = document.querySelector(
          '[data-testid="tier1-top-bar"] > div:nth-child(2)',
        );
        if (zone) zone.scrollLeft = zone.scrollWidth;
      });
      await expect(lastTab).toBeVisible();
      const lastBox = await lastTab.boundingBox();
      expect(lastBox!.x + lastBox!.width).toBeLessThanOrEqual(
        centerBox!.x + centerBox!.width + 1,
      );

      // Density valve engaged: tab padding tightened below 1280.
      const padding = await firstTab.evaluate((el) => {
        const cs = getComputedStyle(el);
        return `${cs.paddingLeft} ${cs.paddingRight}`;
      });
      expect(padding).toBe("8px 8px");
    });
  }
});
