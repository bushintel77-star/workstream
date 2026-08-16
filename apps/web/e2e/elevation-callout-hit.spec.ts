import { expect, test } from "@playwright/test";
import {
  createSurveyProject,
  handoffStudio,
  seedElevationGarden,
} from "./helpers";

/**
 * Elevation callouts must be clickable.
 *
 * An `elevation-label` is a real control (click = select the profile + trace it
 * in plan), so no floating chrome may sit on top of it. The regression this
 * guards is the bottom-centre Sheets strip: it was migrated into the top-edge
 * FrameDrawer but kept its own `CameraChrome` portal, so the DOM escaped the
 * drawer and its stale `bottom: var(--ws-stack-4)` parked it over the middle of
 * the drawing, swallowing callout clicks.
 *
 * The probe hit-tests every callout instead of asserting one strip's geometry —
 * any future dock that lands on the drawing band fails here too.
 */
test.describe("Elevation callout hit-testing", () => {
  test("no chrome intercepts elevation callouts, and clicking one selects", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await seedElevationGarden(request, projectId);

    await page.goto(`/projects/${projectId}?svg=1&mode=elevation`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("elevation-profile")).toBeVisible({
      timeout: 20_000,
    });

    const labels = page.getByTestId("elevation-label");
    await expect(labels.first()).toBeVisible({ timeout: 10_000 });

    /*
     * Hit-test each callout centre. `elementFromPoint` returning anything the
     * callout does not contain means some overlay owns that pixel.
     */
    const blocked = await page.evaluate(() => {
      const describe = (el: Element | null) => {
        if (!el) return "none";
        const testId = el.getAttribute("data-testid");
        const chrome = el.closest("[data-camera-chrome]");
        const chromeId = chrome?.getAttribute("data-testid");
        return [
          el.tagName.toLowerCase(),
          testId ? `#${testId}` : "",
          chromeId ? ` in camera-chrome=${chromeId}` : "",
        ].join("");
      };
      const out: { text: string; blocker: string }[] = [];
      const nodes = Array.from(
        document.querySelectorAll('[data-testid="elevation-label"]'),
      );
      for (const node of nodes) {
        const rect = node.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        // Only judge callouts whose centre is actually on screen.
        if (
          x < 0 ||
          y < 0 ||
          x > window.innerWidth ||
          y > window.innerHeight
        ) {
          continue;
        }
        const hit = document.elementFromPoint(x, y);
        if (hit !== node && !node.contains(hit)) {
          out.push({
            text: (node.textContent ?? "").trim(),
            blocker: describe(hit),
          });
        }
      }
      return out;
    });

    expect(
      blocked,
      `chrome is covering elevation callouts: ${JSON.stringify(blocked)}`,
    ).toEqual([]);

    /*
     * Behavioural proof: click the callout itself (not the silhouette) and the
     * profile is selected — the plan thumbnail previews the same species.
     */
    await expect(page.getByTestId("elevation-profile-swatch")).toHaveCount(0);
    await labels.filter({ hasText: "3.5 m" }).click();
    const swatch = page.getByTestId("elevation-profile-swatch");
    await expect(swatch).toBeVisible({ timeout: 5_000 });
    await expect(swatch.locator("[data-elev-family]").first()).toHaveAttribute(
      "data-elev-family",
      "screen",
    );
    await expect(page.getByTestId("elevation-plan-thumbnail")).toContainText(
      "Pleached hornbeam",
    );
  });

  test("the Sheets strip stays in the frame drawer, off the drawing", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await seedElevationGarden(request, projectId);

    await page.goto(`/projects/${projectId}?svg=1&mode=elevation`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("elevation-profile")).toBeVisible({
      timeout: 20_000,
    });

    const strip = page.getByTestId("artboard-strip");
    if ((await strip.count()) === 0) return;

    // The strip must live inside the top-edge drawer it was migrated into.
    await expect(
      strip.locator('xpath=ancestor::*[@data-testid="frame-drawer-artboards"]'),
    ).toHaveCount(1);

    /*
     * …and never overlap the elevation stage. The drawer parks the strip off the
     * top edge until hovered, so a closed drawer must clear the drawing band.
     */
    const stripBox = await strip.boundingBox();
    const stageBox = await page.getByTestId("elevation-hud").boundingBox();
    expect(stageBox).toBeTruthy();
    if (stripBox) {
      const overlaps =
        stripBox.x < stageBox!.x + stageBox!.width &&
        stripBox.x + stripBox.width > stageBox!.x &&
        stripBox.y < stageBox!.y + stageBox!.height &&
        stripBox.y + stripBox.height > stageBox!.y;
      expect(
        overlaps,
        `Sheets strip ${JSON.stringify(stripBox)} overlaps the elevation stage ${JSON.stringify(stageBox)}`,
      ).toBe(false);
    }
  });
});
