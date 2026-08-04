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
    // Chips now live inside a FrameDrawer (placement="header", no nested
    // CameraChrome). The drawer's CameraChrome shell carries the testid.
    await expect(page.getByTestId("header-vic-gov-status")).toHaveCount(0);
    await expect(page.getByTestId("vic-gov-status-chrome")).toHaveCount(0);
    await expect(titleCluster).toHaveAttribute("data-placement", "header");
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
   * The context cluster was clipped at 1280px when the right data lane was
   * forced open — the `.context[data-lane="busy"]` rule capped it at 360px
   * while the content needed 386px, so data-overflow read true and the tail
   * chip was cut mid-word. The original complaint was "6.1h · Lat…" cut off
   * at the viewport edge.
   *
   * The cluster now lives inside a FrameDrawer (320px panel). The original
   * viewport-clipping bug is resolved because the cluster is no longer at the
   * viewport edge — it's inside the drawer, which is translated off-screen
   * when closed. This test verifies the cluster is a DOM descendant of the
   * drawer, not escaped to the viewport corners via a nested CameraChrome.
   */
  for (const [label, width, height] of [
    ["1280x720", 1280, 720],
    ["1920x1080", 1920, 1080],
  ] as const) {
    test(`context cluster is contained in the drawer at ${label}`, async ({
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

      // The cluster must be a descendant of the drawer, not escaped via a
      // nested CameraChrome portal to the viewport corners.
      const isInDrawer = await page.evaluate(() => {
        const chip = document.querySelector('[data-testid="vic-gov-status-chips-context"]');
        const drawer = document.querySelector('[data-testid="frame-drawer-site-meta"]');
        if (!chip || !drawer) return false;
        return drawer.contains(chip);
      });
      expect(isInDrawer, "cluster must be inside the FrameDrawer").toBe(true);
    });
  }
});
