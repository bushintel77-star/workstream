import { expect, test } from "@playwright/test";
import {
  createSurveyProject,
  handoffStudio,
  openCommandPalette,
} from "./helpers";

const API = process.env.API_URL ?? "http://localhost:3001";

/**
 * View rotate CW + place — placement must use clientToBoardPct (inverse camera).
 * Binding: end-of-build — do not ship rotate without this path verified.
 */
test.describe("View rotate pointer", () => {
  test("place under 90° CW lands at inverse board %, not naive AABB", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);

    const seed = await request.put(
      `${API}/projects/${projectId}/design-canvas`,
      {
        data: {
          placements: [],
          strokes: [],
          irrigation_zones: [],
          site_frame: {
            boundary: [
              { x_pct: 10, y_pct: 10 },
              { x_pct: 90, y_pct: 10 },
              { x_pct: 90, y_pct: 90 },
              { x_pct: 10, y_pct: 90 },
            ],
            building: [
              { x_pct: 20, y_pct: 15 },
              { x_pct: 40, y_pct: 15 },
              { x_pct: 40, y_pct: 30 },
              { x_pct: 20, y_pct: 30 },
            ],
            easements: [],
            services: [],
            levels: [],
          },
        },
      },
    );
    expect(seed.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("cad-plan-board")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("zoom-world")).toBeVisible();

    // Dismiss summonable chrome that steals board clicks (hard when present).
    await page.keyboard.press("Escape");
    const assistNotNow = page.getByRole("button", { name: "Not now" });
    const assistCount = await assistNotNow.count();
    for (let i = 0; i < assistCount; i++) {
      await assistNotNow.nth(i).click({ force: true }).catch(() => undefined);
    }

    await page.getByTestId("handoff-design-studio").click({
      position: { x: 8, y: 8 },
    });
    await page.keyboard.press("]");
    await expect(page.getByTestId("view-north-control")).toBeVisible({
      timeout: 5_000,
    });
    await page.getByTestId("view-rot-step-90").click();
    await page.getByTestId("view-rot-reset-north").click();
    await expect(page.getByTestId("view-north-control")).toHaveCount(0);

    await page.keyboard.press("]");
    await expect(page.getByTestId("zoom-world")).toHaveAttribute(
      "data-view-yaw",
      "90",
      { timeout: 5_000 },
    );
    await expect(page.getByTestId("view-rot-cw")).toBeVisible();

    // French drain — stamp place (not path-grammar, not flora ring).
    await openCommandPalette(page);
    await page.getByLabel("Search assets").fill("place french");
    await page.getByTestId("canvas-command-arm-frenchdrain").click();
    await expect(page.getByTestId("canvas-tool-add")).toHaveAttribute(
      "aria-pressed",
      "true",
      { timeout: 10_000 },
    );

    /*
     * Pick a world % known to sit in outdoor space on a rectangular seed
     * (and usually inside Vicmap lots after hydrate). Compute screen click
     * from the live camera (inline transform on zoom-world).
     */
    const world = { x: 55, y: 60 };
    const click = await page.evaluate((target) => {
      const el = document.querySelector(
        '[data-testid="cad-plan-board"]',
      ) as HTMLElement | null;
      if (!el) throw new Error("cad-plan-board missing");
      const boardEl =
        (el.closest('[data-testid="studio-board"]') as HTMLElement | null) ??
        el;
      const boardRect = boardEl.getBoundingClientRect();
      const zw = document.querySelector(
        '[data-testid="zoom-world"]',
      ) as HTMLElement | null;
      if (!zw) throw new Error("zoom-world missing");
      const rotateDeg = Number(zw.getAttribute("data-view-yaw") ?? "0");
      const origin = (zw.style.transformOrigin || "50% 50%").split(/\s+/);
      const focusX = Number.parseFloat(origin[0] ?? "50") || 50;
      const focusY = Number.parseFloat(origin[1] ?? "50") || 50;
      const tf = zw.style.transform || "";
      const panM = tf.match(
        /translate\(\s*([-\d.]+)px\s*,\s*([-\d.]+)px\s*\)/,
      );
      const zoomM = tf.match(/scale\(\s*([-\d.]+)\s*\)/);
      const cam = {
        boardW: el.clientWidth || 960,
        boardH: el.clientHeight || 640,
        zoom: zoomM ? Number(zoomM[1]) : 1,
        rotateDeg,
        panX: panM ? Number(panM[1]) : 0,
        panY: panM ? Number(panM[2]) : 0,
        focusX,
        focusY,
      };
      const w = Math.max(1, cam.boardW);
      const h = Math.max(1, cam.boardH);
      const ox = (cam.focusX / 100) * w;
      const oy = (cam.focusY / 100) * h;
      const lx = (target.x / 100) * w;
      const ly = (target.y / 100) * h;
      const dx = (lx - ox) * cam.zoom;
      const dy = (ly - oy) * cam.zoom;
      const rad = (cam.rotateDeg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const rx = dx * cos - dy * sin;
      const ry = dx * sin + dy * cos;
      const off = {
        x: cam.panX + ox + rx,
        y: cam.panY + oy + ry,
      };
      // Inverse of the click (what CadPlanBoard.toPct must return).
      const invRad = (-cam.rotateDeg * Math.PI) / 180;
      const invCos = Math.cos(invRad);
      const invSin = Math.sin(invRad);
      const sx = off.x - cam.panX - ox;
      const sy = off.y - cam.panY - oy;
      const irx = sx * invCos - sy * invSin;
      const iry = sx * invSin + sy * invCos;
      const inverse = {
        x: ((ox + irx / cam.zoom) / w) * 100,
        y: ((oy + iry / cam.zoom) / h) * 100,
      };
      const naive = {
        x: (off.x / cam.boardW) * 100,
        y: (off.y / cam.boardH) * 100,
      };
      return {
        clientX: boardRect.left + off.x,
        clientY: boardRect.top + off.y,
        naive,
        inverse,
        rotateDeg,
        cam,
      };
    }, world);

    expect(click.rotateDeg).toBe(90);
    expect(click.inverse.x).toBeCloseTo(world.x, 0);
    expect(click.inverse.y).toBeCloseTo(world.y, 0);
    expect(
      Math.abs(click.naive.x - world.x) + Math.abs(click.naive.y - world.y),
    ).toBeGreaterThan(5);

    await page.mouse.click(click.clientX, click.clientY);

    const item = page.locator(
      '[data-testid="studio-item"][data-item-type="frenchdrain"]',
    );
    await expect(item).toBeVisible({ timeout: 10_000 });

    const placed = await item.evaluate((el) => {
      const style = (el as HTMLElement).style;
      return {
        x: Number.parseFloat(style.left),
        y: Number.parseFloat(style.top),
      };
    });

    // Inverse camera (grid snap may nudge ~1%).
    expect(Math.abs(placed.x - world.x)).toBeLessThan(3);
    expect(Math.abs(placed.y - world.y)).toBeLessThan(3);
    // Naive AABB of the click must not match the placement.
    expect(
      Math.abs(placed.x - click.naive.x) + Math.abs(placed.y - click.naive.y),
    ).toBeGreaterThan(5);

    const saveChip = page.getByTestId("autosave-tick");
    await expect(saveChip).toBeVisible({ timeout: 10_000 });
    await saveChip.click();
    await expect
      .poll(
        async () => {
          const res = await request.get(
            `${API}/projects/${projectId}/design-canvas`,
          );
          if (!res.ok()) return null;
          const body = (await res.json()) as {
            canvas?: {
              placements?: Array<{ x_pct: number; y_pct: number }>;
            };
          };
          return (body.canvas?.placements ?? []).find(
            (p) =>
              Math.abs(p.x_pct - world.x) < 3 &&
              Math.abs(p.y_pct - world.y) < 3,
          );
        },
        { timeout: 20_000 },
      )
      .toBeTruthy();
  });
});
