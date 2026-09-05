import { test, expect, type ConsoleMessage } from "@playwright/test";
import { randomUUID } from "crypto";
import { createAddressProject } from "./helpers";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/**
 * Phase 4 seam e2e — elevation-drawn ink → massing geometry.
 * (docs/PHASE4-SEAM-DECISION-2026.md, gate plan item 3.)
 *
 * A CLOSED outline drawn on a STANDING sketch canvas is massing geometry by
 * construction: its drawn vertical extent is the wall height (D2) and its
 * outline dropped onto the plan is a footprint reconciled against the title
 * boundary (D1). This spec seeds the standing canvas + the closed stroke
 * through the same persisted canvas the studio autosaves to, runs the
 * one-click convert (palette → "Convert strokes to CAD features"), and
 * asserts the feature through persistence — the full honest chain:
 *
 *   elevation ink → wall feature with drawn_height_m + height_source
 *   "operator" + plane_z_m massing + containment stamp.
 */

test.describe("Phase 4 seam — standing canvas wall conversion", () => {
  test("closed outline on a standing canvas converts to a massing wall", async ({
    page,
    request,
  }) => {
    test.setTimeout(process.env.CI ? 600_000 : 300_000);
    const errors: string[] = [];
    page.on("console", (msg: ConsoleMessage) => {
      if (msg.type() === "error") errors.push(msg.text().slice(0, 300));
    });
    page.on("pageerror", (err: Error) =>
      errors.push(`${err.name}: ${err.message.slice(0, 300)}`),
    );

    const { projectId } = await createAddressProject(request, {
      address: "1 Wall Seam Street, Melbourne VIC 3000",
    });

    // Standing canvas: rotated −90° about X → the plane is vertical, spanning
    // world X (board x) and world Y (board y), facing −Z. At scaleM=100 the
    // lot is 100 m: the seeded square is 10 m wide × 3 m tall (world y 3).
    const canvasId = randomUUID();
    const seed = await request.put(`${API}/projects/${projectId}/design-canvas`, {
      data: {
        placements: [],
        strokes: [
          {
            id: randomUUID(),
            points: [
              { x_pct: 45, y_pct: 30 },
              { x_pct: 55, y_pct: 30 },
              { x_pct: 55, y_pct: 27 },
              { x_pct: 45, y_pct: 27 },
              { x_pct: 45, y_pct: 30 },
            ],
            color: "#3B3B3B",
            width_px: 2,
            nib: "ink-03",
            canvas_id: canvasId,
          },
        ],
        canvases: [
          {
            id: canvasId,
            label: "Wall study",
            position: [0, 0, 0],
            rotation: [-Math.SQRT1_2, 0, 0, Math.SQRT1_2],
            season_tag: "ALL",
          },
        ],
        irrigation_zones: [],
        site_frame: {
          boundary: [
            { x_pct: 20, y_pct: 15 },
            { x_pct: 80, y_pct: 15 },
            { x_pct: 80, y_pct: 85 },
            { x_pct: 20, y_pct: 85 },
          ],
          building: [],
          building_source: "traced",
          easements: [],
          services: [],
          levels: [],
        },
      },
    });
    expect(seed.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}?mode=sketch`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
      timeout: 30_000,
    });
    await page.waitForTimeout(4_000);

    // One-click convert — the palette command runs the same
    // convertStrokesToFeatures the Tidy commit uses, with the canvas context.
    await page.keyboard.press("Control+k");
    await expect(page.getByTestId("studio-command-palette")).toBeVisible({
      timeout: 10_000,
    });
    await page.fill('[data-testid="command-palette-input"]', "convert");
    await page
      .getByRole("option", { name: /Convert strokes to CAD features/ })
      .first()
      .click();

    // The conversion persists through autosave — poll the authoritative
    // document for the wall feature. The save pipeline can trail the instant
    // in-store conversion by ~30s (mount save + debounce queue), so the
    // budget is generous; the poll is on persisted truth.
    await expect
      .poll(
        async () => {
          const res = await request.get(
            `${API}/projects/${projectId}/design-canvas`,
          );
          if (!res.ok()) return 0;
          const body = await res.json();
          const features = body?.canvas?.features ?? [];
          return features.filter(
            (f: { drawn_height_m?: number }) =>
              typeof f.drawn_height_m === "number" && f.drawn_height_m > 0,
          ).length;
        },
        { timeout: 90_000, intervals: [2_000, 5_000] },
      )
      .toBe(1);

    const res = await request.get(`${API}/projects/${projectId}/design-canvas`);
    const body = await res.json();
    const wall = body?.canvas?.features?.[0];
    // D2: drawn height carried (0.03 × lot height 110 m at the project's
    // default scale = 3.3 m), provenance operator, plane massing.
    expect(wall.drawn_height_m).toBeGreaterThan(2.5);
    expect(wall.drawn_height_m).toBeLessThan(5);
    expect(wall.height_source).toBe("operator");
    expect(wall.plane_z_m).toBe(4);
    // The footprint is a closed ring, not a zero-width line.
    expect(wall.geometry.type).toBe("Polygon");
    // D1: the seeded footprint sits inside the 20–80 ring — contained, and
    // no crossing stamp.
    expect(wall.boundary_cross).toBeUndefined();

    // Check your work — nothing printed to the console that isn't ours.
    const fatal = errors.filter(
      (e) =>
        e.includes("Maximum update depth") ||
        e.includes("TypeError") ||
        e.includes("ReferenceError"),
    );
    expect(fatal, `Fatal console errors:\n${fatal.join("\n")}`).toHaveLength(0);
  });
});
