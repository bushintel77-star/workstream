import { test, expect, type ConsoleMessage, type Page } from "@playwright/test";
import { createAddressProject } from "./helpers";
import { randomUUID } from "node:crypto";

/**
 * Chrome collision spec — geometric proof that the floating chrome never
 * overlaps itself and never leaves the viewport.
 *
 * For each state (idle / maximum instruments / assets dock open) and at a
 * desktop + a tight viewport, every chrome surface's bounding rect is
 * collected ([data-gs-glass-card], the asset dock, the tool rail) and
 * asserted pairwise non-intersecting (2px tolerance) and fully on-screen.
 *
 * The maximum-instruments state seeds terrain (Section/Flow gate in),
 * an extruded pad (Earth gates in), placements (Quote gates in) and a
 * boundary (Dims gate in) — every card mounted at once.
 */

interface Rect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** True when the card sits in a scrollable column (overflow clips it by
   *  design; vertical viewport escape is then legal, horizontal is not). */
  inScroller: boolean;
}

async function chromeRects(page: Page): Promise<Rect[]> {
  return page.evaluate(() => {
    const els = document.querySelectorAll<HTMLElement>(
      "[data-gs-glass-card], [data-testid='asset-dock'], [data-testid='studio-tool-rail']",
    );
    return Array.from(els).map((el, i) => {
      const r = el.getBoundingClientRect();
      let inScroller = false;
      for (
        let a = el.parentElement;
        a && a instanceof HTMLElement;
        a = a.parentElement
      ) {
        const oy = getComputedStyle(a).overflowY;
        if (
          (oy === "auto" || oy === "scroll") &&
          a.scrollHeight > a.clientHeight
        ) {
          inScroller = true;
          break;
        }
      }
      return {
        id:
          el.getAttribute("data-testid") ??
          el.querySelector("[data-testid]")?.getAttribute("data-testid") ??
          `glass-card-${i}`,
        x: r.x,
        y: r.y,
        w: r.width,
        h: r.height,
        inScroller,
      };
    });
  });
}

const TOL = 2; // px — sub-pixel + shadow tolerance

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w - TOL &&
    b.x < a.x + a.w - TOL &&
    a.y < b.y + b.h - TOL &&
    b.y < a.y + a.h - TOL
  );
}

function expectNoCollisions(rects: Rect[], vw: number, vh: number, label: string) {
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i]!;
      const b = rects[j]!;
      // Cards inside a scrollable column may be clipped below the fold —
      // their layout rects can extend off-screen; overlap with visible chrome
      // is still checked only where both rects are actually visible.
      if (a.inScroller && b.y >= vh) continue;
      if (b.inScroller && a.y >= vh) continue;
      expect(
        overlaps(a, b),
        `${label}: ${a.id} (${Math.round(a.x)},${Math.round(a.y)} ${Math.round(a.w)}x${Math.round(a.h)}) overlaps ${b.id} (${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.w)}x${Math.round(b.h)})`,
      ).toBe(false);
    }
  }
  for (const r of rects) {
    const horizontalOk = r.x >= 0 && r.x + r.w <= vw;
    const verticalOk = r.inScroller || (r.y >= 0 && r.y + r.h <= vh);
    expect(
      horizontalOk && verticalOk,
      `${label}: ${r.id} escapes the viewport (x ${Math.round(r.x)}, y ${Math.round(r.y)}, ${Math.round(r.w)}x${Math.round(r.h)})`,
    ).toBe(true);
  }
}

test.describe("WebGL chrome collision", () => {
  // Four states × two viewports, including two full split-view canvas
  // mounts — exceeds the default budget on cold hardware.
  test.setTimeout(420_000);
  test("no chrome overlaps across states and viewports", async ({
    page,
    request,
  }) => {
    const errors: string[] = [];
    page.on("console", (m: ConsoleMessage) => {
      if (m.type() === "error") errors.push(m.text().slice(0, 300));
    });
    page.on("pageerror", (e) => errors.push(`${e.name}: ${e.message.slice(0, 300)}`));

    // Seed the maximum-chrome project: terrain + pad + placements + boundary.
    const { projectId } = await createAddressProject(request, {
      address: "1 Collision Test Street, Melbourne VIC 3000",
    });
    const place = (symbol_id: string, x_pct: number, y_pct: number) => ({
      id: randomUUID(),
      symbol_id,
      x_pct,
      y_pct,
      rotation_deg: 0,
      scale: 1,
    });
    const seed = await request.put(
      `http://127.0.0.1:3001/projects/${projectId}/design-canvas`,
      {
        data: {
          placements: [place("olive-standard", 40, 45), place("bluestone-paver", 60, 55)],
          strokes: [
            {
              id: randomUUID(),
              points: [
                { x_pct: 30, y_pct: 30 },
                { x_pct: 50, y_pct: 30 },
                { x_pct: 50, y_pct: 50 },
                { x_pct: 30, y_pct: 50 },
                { x_pct: 30, y_pct: 30 },
              ],
              color: "#ff2ef6",
              width_px: 2.5,
              kind: "ink" as const,
              extrude_height_m: 1.2,
            },
          ],
          irrigation_zones: [],
          site_frame: {
            boundary: [
              { x_pct: 15, y_pct: 10 },
              { x_pct: 85, y_pct: 10 },
              { x_pct: 85, y_pct: 90 },
              { x_pct: 15, y_pct: 90 },
            ],
            building: [
              { x_pct: 35, y_pct: 18 },
              { x_pct: 65, y_pct: 18 },
              { x_pct: 65, y_pct: 32 },
              { x_pct: 35, y_pct: 32 },
            ],
            building_source: "traced",
            easements: [],
            services: [],
            levels: [
              { x_pct: 25, y_pct: 25, z_m: 50.0, source: "authored" as const },
              { x_pct: 75, y_pct: 25, z_m: 49.8, source: "authored" as const },
              { x_pct: 25, y_pct: 75, z_m: 51.2, source: "authored" as const },
              { x_pct: 75, y_pct: 75, z_m: 51.0, source: "authored" as const },
            ],
          },
        },
      },
    );
    expect(seed.ok()).toBeTruthy();

    for (const [vw, vh] of [
      [2560, 1080],
      [1280, 720],
      [960, 640],
    ]) {
      await page.setViewportSize({ width: vw, height: vh });
      await page.goto(`/projects/${projectId}?webgl=1`, { waitUntil: "networkidle" });
      await page.waitForTimeout(4000);
      await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
        timeout: 10_000,
      });

      // State 1: idle (default-on instruments: dims + earthworks + quote).
      expectNoCollisions(await chromeRects(page), vw, vh, `idle ${vw}x${vh}`);

      // State 2: maximum — every instrument toggled on.
      for (const tool of ["Section", "Flow", "Underground"]) {
        const name = new RegExp(`^▸ ${tool}$`);
        const btn = page.getByRole("button", { name });
        if (await btn.count()) await btn.click();
      }
      await page.waitForTimeout(600);
      expectNoCollisions(await chromeRects(page), vw, vh, `max ${vw}x${vh}`);

      // State 3: assets dock open on top of everything.
      await page.getByRole("button", { name: "▸ Assets" }).click();
      await page.waitForTimeout(600);
      expectNoCollisions(await chromeRects(page), vw, vh, `assets ${vw}x${vh}`);
      await page.getByRole("button", { name: "▾ Assets" }).click();

      // State 4: split view — chrome wraps TWO viewports; the per-half
      // label chips (25%/75% width) are the new chrome elements.
      await page.getByRole("button", { name: "▸ Split" }).click();
      await page.waitForTimeout(1200);
      const splitRects = await page.evaluate(() => {
        const els = document.querySelectorAll<HTMLElement>(
          "[data-gs-glass-card], [data-testid='asset-dock'], [data-testid='studio-tool-rail'], [data-testid='split-label-plan'], [data-testid='split-label-sketch']",
        );
        return Array.from(els).map((el) => {
          const r = el.getBoundingClientRect();
          let inScroller = false;
          for (
            let a = el.parentElement;
            a && a instanceof HTMLElement;
            a = a.parentElement
          ) {
            const oy = getComputedStyle(a).overflowY;
            if (
              (oy === "auto" || oy === "scroll") &&
              a.scrollHeight > a.clientHeight
            ) {
              inScroller = true;
              break;
            }
          }
          return {
            id: el.getAttribute("data-testid") ?? "card",
            x: r.x,
            y: r.y,
            w: r.width,
            h: r.height,
            inScroller,
          };
        });
      });
      expectNoCollisions(splitRects, vw, vh, `split ${vw}x${vh}`);
      await page.getByTestId("rail-split").evaluate((button: HTMLButtonElement) => {
        button.click();
      });
    }

    const fatal = errors.filter(
      (e) =>
        e.includes("Maximum update depth") ||
        e.includes("TypeError") ||
        e.includes("ReferenceError"),
    );
    expect(fatal, `Fatal console errors:\n${fatal.join("\n")}`).toHaveLength(0);
  });
});
