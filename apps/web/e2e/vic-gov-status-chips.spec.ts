import { expect, test } from "@playwright/test";
import {
  createSurveyProject,
  expectToolDock,
  handoffStudio,
} from "./helpers";

/**
 * Vic-gov status chip row — replaces stacked Env/Services/Site/Trees cards.
 */
test.describe("Vic-gov status chips", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("chip row mounts; Env opens environment panel", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expectToolDock(page);

    const titleCluster = page.getByTestId("vic-gov-status-chips-title");
    const contextCluster = page.getByTestId("vic-gov-status-chips-context");
    await expect(titleCluster).toBeVisible({ timeout: 15_000 });
    await expect(contextCluster).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("header-vic-gov-status")).toHaveCount(0);
    await expect(page.getByTestId("vic-gov-status-chrome")).toBeVisible();
    await expect(titleCluster).toHaveAttribute("data-placement", "dock");
    await expect(titleCluster).toHaveAttribute("data-cluster", "title");
    await expect(contextCluster).toHaveAttribute("data-cluster", "context");
    await expect(page.getByTestId("sticky-meta-stack")).toHaveCount(0);
    await expect(page.getByTestId("vic-gov-chip-boundary")).toBeVisible();
    await expect(page.getByTestId("vic-gov-chip-easements")).toBeVisible();
    await expect(page.getByTestId("vic-gov-chip-byda")).toBeVisible();
    await expect(page.getByTestId("vic-gov-chip-environment")).toBeVisible();

    await page.getByTestId("vic-gov-chip-environment").click();
    await expect(page.getByTestId("right-data-lane-environment")).toBeVisible({
      timeout: 8_000,
    });

    await expect(
      page.locator('[data-testid="zoom-world"] [data-camera-chrome]'),
    ).toHaveCount(0);
  });

  /*
   * The context cluster (top-right) was clipped at 1280px when the right data
   * lane was forced open — the `.context[data-lane="busy"]` rule capped it at
   * 360px while the content needed 386px, so data-overflow read true and the
   * tail chip was cut mid-word with no affordance. Collapsing the lane by
   * default (§6 item 7) released the cap to 420px; the content now fits at
   * 388px and data-overflow reads false. This test records that the clipping
   * is resolved as a side effect, so it cannot silently regress when the lane
   * state or cluster cap changes.
   *
   * Measured at 1280 (the original complaint viewport) and 1920 (wide desktop).
   */
  for (const [label, width, height] of [
    ["1280x720", 1280, 720],
    ["1920x1080", 1920, 1080],
  ] as const) {
    test(`context cluster does not overflow at ${label}`, async ({
      page,
      request,
    }) => {
      await page.setViewportSize({ width, height });
      const { projectId } = await createSurveyProject(request);
      await page.goto(`/projects/${projectId}?mode=survey`);
      await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(4_000);

      const context = page.getByTestId("vic-gov-status-chips-context");
      await expect(context).toBeVisible({ timeout: 15_000 });
      await expect(context).toHaveAttribute("data-overflow", "false");
      await expect(context).toHaveAttribute("data-lane", "free");
    });
  }
});
