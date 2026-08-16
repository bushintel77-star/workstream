import { expect, test, type Page } from "@playwright/test";
import { handoffStudio } from "./helpers";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/*
 * Six-vertex L-shape boundary + a dwelling rectangle. The inner corner gives
 * the declutter engine adjacent short edges to resolve, and the dwelling adds a
 * second dim ring — enough labels to make an overlap meaningful at high zoom.
 */
const SITE_FRAME = {
  boundary: [
    { x_pct: 22, y_pct: 16 },
    { x_pct: 58, y_pct: 16 },
    { x_pct: 58, y_pct: 44 },
    { x_pct: 80, y_pct: 44 },
    { x_pct: 80, y_pct: 84 },
    { x_pct: 22, y_pct: 84 },
  ],
  building: [
    { x_pct: 30, y_pct: 22 },
    { x_pct: 52, y_pct: 22 },
    { x_pct: 52, y_pct: 38 },
    { x_pct: 30, y_pct: 38 },
  ],
  building_source: "traced",
  easements: [],
  services: [],
  levels: [],
};

async function seedBoundary(request: import("@playwright/test").APIRequestContext) {
  const create = await request.post(`${API}/projects/`, {
    data: {
      address: "E2E Annotation Labels, 9 Probe Way, Melbourne VIC 3000",
      lat: -37.8136,
      lng: 144.9631,
    },
  });
  expect(create.ok()).toBeTruthy();
  const body = (await create.json()) as { project: { id: string } };
  const projectId = body.project.id;
  const survey = await request.post(`${API}/projects/${projectId}/survey`);
  expect(survey.ok()).toBeTruthy();
  const seed = await request.put(`${API}/projects/${projectId}/design-canvas`, {
    data: { placements: [], strokes: [], irrigation_zones: [], site_frame: SITE_FRAME },
  });
  expect(seed.ok()).toBeTruthy();
  return { projectId };
}

/** Current `.zoomWorld` scale from its transform matrix. */
async function zoomWorldScale(page: Page) {
  const transform = await page
    .getByTestId("zoom-world")
    .evaluate((el) => getComputedStyle(el).transform);
  const m = /matrix\(([^,]+)/.exec(transform);
  return m ? Number(m[1]) : 1;
}

/*
 * Wheel toward a target zoom. Wheel is exponential and focus-anchored, so we
 * tick and re-read until we land within a band. `dir` = -1 zooms in (scroll up).
 */
async function wheelToZoom(page: Page, target: number, boardBox: { x: number; y: number; width: number; height: number }) {
  const cx = boardBox.x + boardBox.width / 2;
  const cy = boardBox.y + boardBox.height / 2;
  await page.mouse.move(cx, cy);
  await expect
    .poll(
      async () => {
        const z = await zoomWorldScale(page);
        if (Number.isFinite(z) && Math.abs(z - target) / target > 0.06) {
          const dir = z < target ? -1 : 1;
          await page.mouse.wheel(0, dir * 120);
        }
        return Math.abs(z - target) / target;
      },
      { timeout: 25_000 },
    )
    .toBeLessThan(0.08);
  // Let the lodFade transition + portal settle.
  await page.waitForTimeout(300);
}

type LabelRect = { x: number; y: number; w: number; h: number; fs: number };

/** Collect rendered dim-label spans: viewport rect + computed font-size. */
async function collectDimLabels(page: Page): Promise<LabelRect[]> {
  return page.evaluate(() => {
    const shells = Array.from(
      document.querySelectorAll(
        '[data-testid="outside-dim-label"], [data-testid="cad-edge-dim"], [data-testid="fit-outside-dim-label"]',
      ),
    );
    const out: Array<{ x: number; y: number; w: number; h: number; fs: number }> = [];
    for (const sh of shells) {
      const span = sh.querySelector("span");
      if (!span) continue;
      const r = span.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      const fs = parseFloat(getComputedStyle(span).fontSize);
      out.push({ x: r.left, y: r.top, w: r.width, h: r.height, fs });
    }
    return out;
  });
}

function boxesOverlap(a: LabelRect, b: LabelRect, eps = 0.5): boolean {
  return (
    a.x < b.x + b.w - eps &&
    a.x + a.w - eps > b.x &&
    a.y < b.y + b.h - eps &&
    a.y + a.h - eps > b.y
  );
}

test.describe("Annotation labels are viewport instruments", () => {
  test("dim labels keep constant font-size and never overlap across three zoom levels", async ({
    page,
    request,
  }) => {
    const { projectId } = await seedBoundary(request);
    // Survey mode renders the dim ring (showDims includes mode === "survey").
    await page.goto(`/projects/${projectId}?svg=1&mode=survey`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("zoom-world")).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => page.getByTestId("cad-plan-board").count(), { timeout: 20_000 })
      .toBeGreaterThan(0);

    const board = page.getByTestId("studio-board");
    let box = await board.boundingBox();
    await expect
      .poll(async () => {
        box = await board.boundingBox();
        return box != null;
      }, { timeout: 10_000 })
      .toBe(true);
    expect(box).toBeTruthy();

    const fontSizes = new Set<number>();
    for (const target of [1.2, 2.5, 5.0]) {
      await wheelToZoom(page, target, box!);
      const zoom = await zoomWorldScale(page);

      const labels = await collectDimLabels(page);
      // Mid/high tier must surface at least one dim label.
      expect(labels.length, `zoom=${zoom.toFixed(2)} should render dim labels`).toBeGreaterThan(0);

      // No two rendered label boxes may overlap (declutter + viewport fix).
      for (let i = 0; i < labels.length; i++) {
        for (let j = i + 1; j < labels.length; j++) {
          expect(
            boxesOverlap(labels[i]!, labels[j!]),
            `zoom=${zoom.toFixed(2)} labels ${i}/${j} overlap: ${JSON.stringify(labels[i])} vs ${JSON.stringify(labels[j])}`,
          ).toBe(false);
        }
      }

      for (const lab of labels) fontSizes.add(Math.round(lab.fs));
    }

    // Font-size is a viewport constant — one value across every zoom level.
    expect(fontSizes.size, `font sizes must be constant across zooms, got ${[...fontSizes].join(", ")}`).toBe(1);
  });
});
