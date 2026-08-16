import { expect, test } from "@playwright/test";
import {
  createSurveyProject,
  expectToolDock,
  handoffStudio,
} from "./helpers";

/**
 * Smart buildable envelope — high-stakes arm auto-shows laser;
 * pin persists across low-stakes tool switch; cursor outside remnant
 * surfaces setback violation chip.
 */
test.describe("Buildable area smart envelope", () => {
  test("deck arm shows laser; pin survives lawn; outside cursor violates", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await page.goto(`/projects/${projectId}?svg=1&mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("zoom-world")).toBeVisible({
      timeout: 15_000,
    });
    await expect
      .poll(async () => page.getByTestId("cad-plan-board").count(), {
        timeout: 20_000,
      })
      .toBeGreaterThan(0);
    await expectToolDock(page);

    await expect(page.getByTestId("buildable-area-overlay")).toHaveCount(0);

    await page.getByTestId("canvas-tool-add").click();
    const panel = page.getByTestId("asset-panel");
    await expect(panel).toBeVisible({ timeout: 8_000 });
    await page.getByTestId("swatch-deck").click();
    await expect(page.getByTestId("paint-swatch-deck")).toBeVisible({
      timeout: 5_000,
    });
    await page.getByTestId("paint-swatch-deck").click();

    const overlay = page.getByTestId("buildable-area-overlay");
    await expect(overlay).toBeVisible({ timeout: 8_000 });
    await expect(overlay).toHaveAttribute("data-intensity", "auto");
    await expect(page.getByTestId("buildable-polygon").first()).toBeVisible();
    await expect(page.getByTestId("buildable-area-chip")).toBeVisible();

    await page.getByTestId("buildable-area-pin").click();
    await expect(overlay).toHaveAttribute("data-pinned", "1");
    await expect(overlay).toHaveAttribute("data-intensity", "full");

    // Low-stakes arm — pin keeps the laser up.
    await page.getByTestId("swatch-lawn").click();
    await page.getByTestId("paint-swatch-lawn").click();
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveAttribute("data-pinned", "1");

    // Board centre is often the dwelling / setback void — derive ok/danger from
    // the laser polygon itself so demo footprints and Vicmap lots both pass.
    const targets = await page.evaluate(() => {
      const poly = document.querySelector(
        '[data-testid="buildable-polygon"]',
      ) as SVGPolygonElement | null;
      const board = document.querySelector(
        '[data-testid="cad-plan-board"]',
      ) as HTMLElement | null;
      if (!poly || !board) return null;
      const pts = (poly.getAttribute("points") ?? "")
        .trim()
        .split(/\s+/)
        .map((pair) => {
          const [x, y] = pair.split(",").map(Number);
          return { x, y };
        })
        .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
      if (pts.length < 3) return null;
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      const svg = poly.ownerSVGElement;
      const ctm = poly.getScreenCTM();
      if (!svg || !ctm) return null;
      const toScreen = (x: number, y: number) => {
        const p = svg.createSVGPoint();
        p.x = x;
        p.y = y;
        const s = p.matrixTransform(ctm);
        return { x: s.x, y: s.y };
      };
      const ok = toScreen(cx, cy);
      const boardBox = board.getBoundingClientRect();
      // Prefer a point in the lot that is outside the remnant (setback band).
      // Fall back to the far board edge if the remnant fills the board.
      const candidates = [
        toScreen(
          Math.min(...pts.map((p) => p.x)) - 2,
          cy,
        ),
        toScreen(
          Math.max(...pts.map((p) => p.x)) + 2,
          cy,
        ),
        {
          x: boardBox.x + boardBox.width * 0.97,
          y: boardBox.y + boardBox.height * 0.55,
        },
      ];
      const out =
        candidates.find(
          (c) =>
            c.x >= boardBox.x &&
            c.x <= boardBox.right &&
            c.y >= boardBox.y &&
            c.y <= boardBox.bottom,
        ) ?? candidates[candidates.length - 1]!;
      return { ok, out };
    });
    expect(targets).toBeTruthy();

    await page.mouse.move(targets!.ok.x, targets!.ok.y);
    await expect
      .poll(
        async () =>
          page.getByTestId("buildable-area-chip").getAttribute("data-tone"),
        { timeout: 8_000 },
      )
      .toBe("ok");
    await page.mouse.move(targets!.out.x, targets!.out.y);
    await expect
      .poll(
        async () =>
          page.getByTestId("buildable-area-chip").getAttribute("data-tone"),
        { timeout: 8_000 },
      )
      .toBe("danger");
    await expect(page.getByTestId("buildable-area-chip")).toContainText(
      /Setback violation/i,
    );
  });
});
