import { test, expect, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createAddressProject } from "./helpers";

/** Prefer 127.0.0.1 — `localhost` can resolve to ::1 while the API binds IPv4. */
const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/**
 * Survey setup panel — the unified Survey mode body.
 *
 * The Survey screen had no e2e coverage at all, so both of its states and the
 * canvas locate state were unverifiable. Completion is derived from real
 * project data (`surveySetup.ts` → `surveyChecklistRows`), which means a
 * fixture can drive the panel through 0/5 → 1/5 → 5/5 purely by seeding the
 * design canvas — no manual ticking exists to fake.
 */

const RING = [
  { x_pct: 15, y_pct: 10 },
  { x_pct: 85, y_pct: 10 },
  { x_pct: 85, y_pct: 90 },
  { x_pct: 15, y_pct: 90 },
];

const BUILDING = [
  { x_pct: 35, y_pct: 18 },
  { x_pct: 65, y_pct: 18 },
  { x_pct: 65, y_pct: 32 },
  { x_pct: 35, y_pct: 32 },
];

type SiteFrame = Record<string, unknown>;

async function putCanvas(
  request: APIRequestContext,
  projectId: string,
  siteFrame: SiteFrame,
  placements: Array<Record<string, unknown>> = [],
) {
  const res = await request.put(`${API}/projects/${projectId}/design-canvas`, {
    data: {
      placements,
      strokes: [],
      irrigation_zones: [],
      site_frame: siteFrame,
    },
  });
  expect(res.ok(), "seed design-canvas").toBeTruthy();
}

/** Nothing captured — every checklist row is open and the canvas is empty. */
const EMPTY_FRAME: SiteFrame = {
  boundary: [],
  easements: [],
  services: [],
  levels: [],
  byda_assets: [],
};

/** Boundary only — the 1/5 state. */
const BOUNDARY_ONLY: SiteFrame = { ...EMPTY_FRAME, boundary: RING };

/** All five rows backed by real data — the 5/5 completion state. */
const COMPLETE_FRAME: SiteFrame = {
  boundary: RING,
  building: BUILDING,
  building_source: "traced",
  easements: [RING],
  services: [],
  levels: [
    { x_pct: 25, y_pct: 25, z_m: 50.0, source: "authored" },
    { x_pct: 75, y_pct: 75, z_m: 51.2, source: "authored" },
  ],
  byda_assets: [
    {
      id: "sewer-1",
      kind: "sewer",
      ring: [
        { x_pct: 20, y_pct: 80 },
        { x_pct: 80, y_pct: 80 },
      ],
      source: "traced",
    },
  ],
};

/**
 * A project with no survey run AND no coordinates.
 *
 * Two things seed geometry behind a test's back. `createAddressProject` posts
 * `/survey`, which is the right fixture for the populated states but can never
 * show a pre-import canvas. The studio then runs a quiet Vicmap auto-trace on
 * mount whenever the boundary is short — it self-disables under
 * `NEXT_PUBLIC_E2E`, but that only holds when the web server was started by
 * this config rather than reused (see AGENTS.md on reusing a plain dev server).
 *
 * Omitting lat/lng makes the fixture deterministic either way: the auto-trace
 * returns early without coordinates, so an empty canvas stays empty.
 */
async function createBareProject(request: APIRequestContext, address: string) {
  const create = await request.post(`${API}/projects/`, { data: { address } });
  expect(create.ok(), "create project").toBeTruthy();
  const body = (await create.json()) as { project: { id: string } };
  return { projectId: body.project.id };
}

/** An existing tree — `existing-tree-retain` maps to the `exist` type. */
function existingTree() {
  return {
    id: randomUUID(),
    symbol_id: "existing-tree-retain",
    x_pct: 40,
    y_pct: 60,
    rotation_deg: 0,
    scale: 1,
  };
}

/** Billable placement so the running-estimate companion has lines to summarize. */
function billableTree() {
  return {
    id: randomUUID(),
    symbol_id: "olive-standard",
    x_pct: 55,
    y_pct: 45,
    rotation_deg: 0,
    scale: 1,
  };
}

async function openSurvey(page: import("@playwright/test").Page, projectId: string) {
  await page.goto(`/projects/${projectId}?mode=survey`, {
    waitUntil: "networkidle",
  });
  await expect(page.getByTestId("webgl-studio")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("survey-setup-panel")).toBeVisible({
    timeout: 20_000,
  });
}

test.describe("Survey setup panel", () => {
  test.setTimeout(180_000);

  test("renders ONE panel, derives progress from data, and routes a row by keyboard", async ({
    page,
    request,
  }) => {
    const { projectId } = await createAddressProject(request, {
      address: "1 Survey Setup Street, Prahran VIC 3181",
    });
    await putCanvas(request, projectId, BOUNDARY_ONLY, [billableTree()]);
    await openSurvey(page, projectId);

    // One consolidated panel — the old layout stacked an import block and a
    // separate checklist card inside the dock.
    await expect(page.getByTestId("perimeter-panel")).toHaveCount(1);
    await expect(page.getByTestId("survey-checklist")).toHaveCount(0);

    // Progress is derived: boundary only — existing trees row stays open.
    await expect(page.getByTestId("survey-setup-count")).toHaveText(
      "1 of 5 complete",
    );
    await expect(page.getByTestId("survey-row-boundary")).toHaveAttribute(
      "data-done",
      "true",
    );
    for (const id of ["dwelling", "trees", "levels", "services"]) {
      await expect(page.getByTestId(`survey-row-${id}`)).toHaveAttribute(
        "data-done",
        "false",
      );
    }

    // The chrome pill reads the same derivation as the panel.
    await expect(page.getByTestId("survey-progress")).toHaveText("Survey · 1/5");

    // The import CTA is present and is the panel's primary action.
    await expect(page.getByTestId("import-site-truth")).toBeVisible();

    // Running estimate stays visible as a compact companion — coexistence, not
    // suppression — and must not open itemized by default.
    await expect(page.getByTestId("estimator-panel")).toHaveAttribute(
      "data-estimator-companion",
      "compact",
    );
    await expect(page.getByTestId("fit-sheet-pill")).toBeVisible();
    await expect(page.getByTestId("fit-sheet-card")).toHaveCount(0);
    await expect(page.getByTestId("fit-sheet-pill")).toContainText("Provisional");

    // Rows are keyboard-operable: focus + Enter must route, not just click.
    const trees = page.getByTestId("survey-row-trees");
    await trees.focus();
    await expect(trees).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("asset-library")).toBeVisible({ timeout: 10_000 });
  });

  test("shows the canvas locate state only while the boundary is missing", async ({
    page,
    request,
  }) => {
    const { projectId } = await createBareProject(
      request,
      "2 Survey Locate Street, Prahran VIC 3181",
    );
    await putCanvas(request, projectId, EMPTY_FRAME);
    await openSurvey(page, projectId);

    await expect(page.getByTestId("survey-setup-count")).toHaveText(
      "0 of 5 complete",
    );
    const locate = page.getByTestId("survey-locate-state");
    await expect(locate).toBeVisible();
    // It names the property rather than showing a bare fill.
    await expect(locate).toContainText("Survey Locate Street");

    // Once the boundary lands the placeholder must retire.
    await putCanvas(request, projectId, BOUNDARY_ONLY);
    await openSurvey(page, projectId);
    await expect(page.getByTestId("survey-locate-state")).toHaveCount(0);
  });

  test("at 5 of 5 the panel collapses, expands back, and hands off to Sketch", async ({
    page,
    request,
  }) => {
    const { projectId } = await createAddressProject(request, {
      address: "3 Survey Complete Street, Prahran VIC 3181",
    });
    await putCanvas(request, projectId, COMPLETE_FRAME, [existingTree()]);
    await openSurvey(page, projectId);

    await expect(page.getByTestId("survey-setup-count")).toHaveText(
      "5 of 5 complete",
    );

    // The import CTA is replaced by the handoff, and the pill retires — a
    // permanent "5/5" is chrome with nothing left to say.
    await expect(page.getByTestId("import-site-truth")).toHaveCount(0);
    await expect(page.getByTestId("survey-progress")).toHaveCount(0);

    // The list collapses to a summary row and expands back on click.
    const summary = page.getByTestId("survey-summary-row");
    await expect(summary).toBeVisible();
    await expect(summary).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByTestId("survey-row-boundary")).toHaveCount(0);
    await summary.click();
    await expect(summary).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("survey-row-boundary")).toBeVisible();

    // Continue to Sketch — enabled only once the survey carries aerial/title,
    // which is a separate server-derived flag from the checklist count.
    const cont = page.getByTestId("survey-continue-sketch");
    await expect(cont).toBeVisible();
    if (await cont.isEnabled()) {
      await cont.click();
      // Mode tabs carry no aria-pressed (only meta tabs do), so the handoff is
      // asserted by the surfaces: the survey panel retires and the sketch body
      // takes the dock.
      await expect(page.getByTestId("survey-setup-panel")).toHaveCount(0, {
        timeout: 10_000,
      });
      await expect(page.getByTestId("sketch-stitch")).toBeVisible({
        timeout: 10_000,
      });
    } else {
      // Honest fallback: the panel must say why rather than fail silently.
      await expect(page.getByTestId("survey-setup-panel")).toContainText(
        "aerial and title",
      );
    }
  });
});
