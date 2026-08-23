import {
  expect,
  test,
  type APIRequestContext,
  type ConsoleMessage,
  type Page,
} from "@playwright/test";
import { randomUUID } from "node:crypto";

/** Prefer 127.0.0.1 — `localhost` can resolve to ::1 while the API binds IPv4. */
const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/**
 * Precision drafting tools — the kept probe for Polyline + Area on the WebGL
 * surface (docs/precision-drafting-tools-spec.md §9).
 *
 * What it proves, end to end:
 *   - the rail arms a tool, clicks place exact vertices, the live readout
 *     reports length + bearing, and the origin snap closes the run;
 *   - a Polyline persists as a `kind: "shape"` stroke carrying BOTH the
 *     clicked `shape_points` and the flattened `points` — the field the
 *     existing CommittedStrokeRenderer draws from, so it renders with no new
 *     renderer, and it survives a reload;
 *   - an Area persists as a Polygon `LandscapeFeature`, is selectable after a
 *     reload, and — once given a pad height in the inspector — is read as a
 *     cut/fill pad by earthworks ALONGSIDE a legacy extruded stroke. That last
 *     assertion is the §8.1 coupling verified rather than assumed.
 */

const BOUNDARY = [
  { x_pct: 15, y_pct: 10 },
  { x_pct: 85, y_pct: 10 },
  { x_pct: 85, y_pct: 90 },
  { x_pct: 15, y_pct: 90 },
];

/** Four spot levels — terrain is what gates the earthworks instrument. */
const LEVELS = [
  { x_pct: 25, y_pct: 25, z_m: 50.0, source: "authored" as const },
  { x_pct: 75, y_pct: 25, z_m: 49.6, source: "authored" as const },
  { x_pct: 25, y_pct: 75, z_m: 51.1, source: "authored" as const },
  { x_pct: 75, y_pct: 75, z_m: 50.4, source: "authored" as const },
];

/**
 * A legacy freehand pad — a closed stroke carrying extrude_height_m, parked in
 * the north-west corner well clear of the board centre the drafting clicks
 * use. This is earthworks' original input; the Area work must not displace it.
 */
function legacyExtrudedPad() {
  return {
    id: randomUUID(),
    points: [
      { x_pct: 20, y_pct: 20 },
      { x_pct: 32, y_pct: 20 },
      { x_pct: 32, y_pct: 32 },
      { x_pct: 20, y_pct: 32 },
      { x_pct: 20, y_pct: 20 },
    ],
    color: "#3B3B3B",
    width_px: 2.5,
    kind: "ink" as const,
    extrude_height_m: 1.1,
  };
}

/**
 * A surveyed project whose canvas is then seeded explicitly.
 *
 * The survey POST is not optional: Sketch mode only unlocks on
 * `progress.hasAerial` (`lib/canvas-mode.ts`), and without it the studio falls
 * back to Survey — where the mode panel owns the right dock and the Terrain
 * tab body never renders.
 *
 * Seeding behind a test's back is still the hazard to guard against. The
 * studio runs a quiet Vicmap auto-trace on mount whenever the boundary is
 * short, and its `NEXT_PUBLIC_E2E` guard only holds when this config started
 * the web server rather than reusing a long-running one (AGENTS.md). The PUT
 * below always lands a four-point boundary, which is what makes this fixture
 * deterministic either way — the auto-trace returns early once a boundary
 * exists, so `strokes` and `features` stay exactly as seeded.
 */
async function createSurveyedProject(
  request: APIRequestContext,
  address: string,
) {
  const create = await request.post(`${API}/projects/`, {
    data: { address, lat: -37.85, lng: 145.0 },
  });
  expect(create.ok(), "create project").toBeTruthy();
  const body = (await create.json()) as { project: { id: string } };
  const survey = await request.post(`${API}/projects/${body.project.id}/survey`);
  expect(survey.ok(), "run survey").toBeTruthy();
  return body.project.id;
}

async function putCanvas(
  request: APIRequestContext,
  projectId: string,
  strokes: Array<Record<string, unknown>>,
) {
  const res = await request.put(`${API}/projects/${projectId}/design-canvas`, {
    data: {
      placements: [],
      strokes,
      irrigation_zones: [],
      features: [],
      site_frame: {
        boundary: BOUNDARY,
        easements: [],
        services: [],
        levels: LEVELS,
        byda_assets: [],
      },
    },
  });
  expect(res.ok(), "seed design-canvas").toBeTruthy();
}

interface SavedCanvas {
  strokes?: Array<{
    kind?: string;
    shape_tool?: string;
    shape_closed?: boolean;
    shape_points?: Array<{ x_pct: number; y_pct: number }>;
    points?: Array<{ x_pct: number; y_pct: number }>;
    extrude_height_m?: number;
  }>;
  features?: Array<{
    id: string;
    geometry: { type: string; points: unknown[] };
    metadata: { friendly_name?: string; user_modification_state: string };
    material_fill?: { sku: string };
    extrude_height_m?: number;
  }>;
}

async function savedCanvas(
  request: APIRequestContext,
  projectId: string,
): Promise<SavedCanvas> {
  const res = await request.get(`${API}/projects/${projectId}/design-canvas`);
  expect(res.ok(), "read design-canvas").toBeTruthy();
  const body = (await res.json()) as { canvas?: SavedCanvas };
  return body.canvas ?? {};
}

async function openStudio(page: Page, projectId: string) {
  await page.goto(`/projects/${projectId}?mode=sketch`, {
    waitUntil: "networkidle",
  });
  await expect(page.getByTestId("webgl-studio")).toBeVisible({
    timeout: 30_000,
  });
  // Give the R3F scene a beat to mount before pointer geometry is measured.
  await page.waitForTimeout(2500);
}

/** Place one vertex: hover first (so the rubber band + readout update), click. */
async function placeVertex(page: Page, x: number, y: number) {
  await page.mouse.move(x, y, { steps: 4 });
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(180);
}

function fatalErrors(errors: string[]): string[] {
  return errors.filter(
    (e) =>
      e.includes("Maximum update depth") ||
      e.includes("TypeError") ||
      e.includes("ReferenceError"),
  );
}

test.describe("WebGL precision drafting tools", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("Polyline places exact vertices, closes on the origin, and persists", async ({
    page,
    request,
  }) => {
    test.setTimeout(480_000); // observed mouse.move hitting the 300s ceiling on software GL
    const errors: string[] = [];
    page.on("console", (m: ConsoleMessage) => {
      if (m.type() === "error") errors.push(m.text().slice(0, 300));
    });
    page.on("pageerror", (e: Error) =>
      errors.push(`${e.name}: ${e.message.slice(0, 300)}`),
    );

    const projectId = await createSurveyedProject(
      request,
      "1 Polyline Terrace, Prahran VIC 3181",
    );
    await putCanvas(request, projectId, []);
    await openStudio(page, projectId);

    // The canvas starts with no ink — S0 is the honest baseline.
    await expect(page.getByTestId("strip-stats")).toContainText("S0");

    // Arm Polyline from the rail; the run starts empty.
    await page.getByTestId("rail-polyline").click();
    await expect(page.getByTestId("draft-status")).toContainText("0 vertices");

    const canvas = page.getByTestId("webgl-canvas");
    const box = (await canvas.boundingBox())!;
    const cx = Math.round(box.x + box.width / 2);
    const cy = Math.round(box.y + box.height / 2);
    const d = 120;

    await placeVertex(page, cx - d, cy - d);
    await expect(page.getByTestId("draft-status")).toContainText("1 vertex");

    // The live readout follows the cursor with a derived length AND bearing.
    await page.mouse.move(cx + d, cy - d, { steps: 6 });
    const readout = page.getByTestId("draft-readout");
    await expect(readout).toBeVisible({ timeout: 10_000 });
    await expect(readout).toHaveText(/\d+\.\d{2}\sm\s·\s\d+°/);

    await placeVertex(page, cx + d, cy - d);
    await placeVertex(page, cx + d, cy + d);
    await placeVertex(page, cx - d, cy + d);
    await expect(page.getByTestId("draft-status")).toContainText("4 vertices");

    // Clicking the origin is the `close` snap — it finishes a closed run.
    await placeVertex(page, cx - d, cy - d);

    // One committed stroke, and the tool stays armed with a fresh run.
    await expect(page.getByTestId("strip-stats")).toContainText("S1", {
      timeout: 15_000,
    });
    await expect(page.getByTestId("draft-status")).toContainText("0 vertices");

    // Esc disarms the tool entirely (the readout chip retires with it).
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("draft-status")).toHaveCount(0);

    // Persistence: the stroke must carry the control points AND the flattened
    // render path, because `points` alone is what makes it render.
    await expect
      .poll(
        async () => (await savedCanvas(request, projectId)).strokes?.length ?? 0,
        { timeout: 30_000, message: "polyline stroke autosaved" },
      )
      .toBe(1);
    const saved = (await savedCanvas(request, projectId)).strokes![0]!;
    expect(saved.kind).toBe("shape");
    expect(saved.shape_tool).toBe("polyline");
    expect(saved.shape_closed).toBe(true);
    expect(saved.shape_points).toHaveLength(4);
    expect(saved.points).toHaveLength(5);
    expect(saved.points![4]).toEqual(saved.points![0]);

    // Reload: the shape hydrates and renders through the existing stroke path.
    await openStudio(page, projectId);
    await expect(page.getByTestId("strip-stats")).toContainText("S1", {
      timeout: 20_000,
    });

    const fatal = fatalErrors(errors);
    expect(fatal, `Fatal console errors:\n${fatal.join("\n")}`).toHaveLength(0);
  });

  test("Area closes into a persisted region that earthworks reads as a pad", async ({
    page,
    request,
  }) => {
    test.setTimeout(420_000); // observed mouse.move hitting the 300s ceiling on software GL
    const errors: string[] = [];
    page.on("console", (m: ConsoleMessage) => {
      if (m.type() === "error") errors.push(m.text().slice(0, 300));
    });
    page.on("pageerror", (e: Error) =>
      errors.push(`${e.name}: ${e.message.slice(0, 300)}`),
    );

    const projectId = await createSurveyedProject(
      request,
      "2 Area Grove, Prahran VIC 3181",
    );
    // Seed the legacy freehand pad so both earthworks inputs are in play.
    await putCanvas(request, projectId, [legacyExtrudedPad()]);
    await openStudio(page, projectId);

    // Baseline: earthworks already sees the legacy extruded stroke as one pad.
    await page.getByTestId("meta-tab-terrain").click();
    const earthChip = page.getByRole("button", { name: "Expand Earth" });
    await expect(earthChip).toContainText("1 pads", { timeout: 20_000 });
    await page.getByTestId("meta-tab-terrain").click();

    // Draft the region.
    await page.getByTestId("rail-area").click();
    await expect(page.getByTestId("draft-status")).toContainText("Area");

    const canvas = page.getByTestId("webgl-canvas");
    const box = (await canvas.boundingBox())!;
    const cx = Math.round(box.x + box.width / 2);
    const cy = Math.round(box.y + box.height / 2);
    const d = 110;

    await placeVertex(page, cx - d, cy - d);
    await placeVertex(page, cx + d, cy - d);
    await placeVertex(page, cx + d, cy + d);
    await placeVertex(page, cx - d, cy + d);
    await expect(page.getByTestId("draft-status")).toContainText("4 vertices");
    // The area readout is a live m² figure, not a length.
    await expect(page.getByTestId("draft-status")).toContainText("m²");

    // Close on the origin snap.
    await placeVertex(page, cx - d, cy - d);
    await expect(page.getByTestId("draft-status")).toContainText("0 vertices");

    // The region persists as a Polygon LandscapeFeature — costable on
    // creation, with the material stamped unspecified rather than guessed,
    // and no pad height (height is an edit, not a draw).
    await expect
      .poll(
        async () =>
          (await savedCanvas(request, projectId)).features?.length ?? 0,
        { timeout: 30_000, message: "area feature autosaved" },
      )
      .toBe(1);
    const feature = (await savedCanvas(request, projectId)).features![0]!;
    expect(feature.geometry.type).toBe("Polygon");
    expect(feature.geometry.points).toHaveLength(4);
    expect(feature.metadata.friendly_name).toBe("Drafted area");
    expect(feature.metadata.user_modification_state).toBe("human_locked");
    expect(feature.material_fill?.sku).toBe("unspecified");
    expect(feature.extrude_height_m).toBeUndefined();
    // Drafting a region must not mint linework — only the seeded pad remains.
    expect((await savedCanvas(request, projectId)).strokes).toHaveLength(1);

    // Reload, then prove the region hydrated as a real selectable entity.
    await openStudio(page, projectId);
    await page.getByTestId("rail-marquee").click();
    await page.mouse.move(cx - 200, cy - 200);
    await page.mouse.down();
    await page.mouse.move(cx + 200, cy + 200, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByTestId("selection-count")).toContainText(
      "1 selected",
      { timeout: 15_000 },
    );
    await expect(page.getByTestId("inspector-feature-name")).toHaveValue(
      "Drafted area",
    );

    // §8.1: giving the region a height turns it into a cut/fill pad — an EDIT
    // on a region, not a second drawing mode — and earthworks must now count
    // BOTH the legacy extruded stroke and the drafted Area.
    await page.getByTestId("inspector-feature-pad-height").fill("0.8");
    await expect
      .poll(
        async () =>
          (await savedCanvas(request, projectId)).features?.[0]
            ?.extrude_height_m ?? 0,
        { timeout: 30_000, message: "pad height autosaved" },
      )
      .toBeCloseTo(0.8, 5);

    await page.getByTestId("meta-tab-terrain").click();
    await expect(page.getByRole("button", { name: "Expand Earth" })).toContainText(
      "2 pads",
      { timeout: 20_000 },
    );
    await page.getByRole("button", { name: "Expand Earth" }).click();
    await expect(page.getByTestId("earthworks-card")).toContainText("Pad 1");
    await expect(page.getByTestId("earthworks-card")).toContainText("Pad 2");

    const fatal = fatalErrors(errors);
    expect(fatal, `Fatal console errors:\n${fatal.join("\n")}`).toHaveLength(0);
  });
});
