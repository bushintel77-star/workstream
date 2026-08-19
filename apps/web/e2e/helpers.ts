import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** Prefer 127.0.0.1 — `localhost` can resolve to ::1 while the API binds IPv4. */
const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/** Canonical Tier-1 Wrights address (proposal v3 / workbook lock). */
export const TIER1_WRIGHTS_ADDRESS =
  "36 Wrights Terrace, Prahran VIC 3181";

/** Control site that must never unlock Tier-1 surfaces. */
export const TIER1_CONTROL_ADDRESS = "3 Test St, Carlton VIC 3053";

/** Legacy pipeline chrome — must stay absent on canvas-first routes. */
export function pipelineShell(page: Page) {
  return page.locator('[data-testid="project-pipeline-shell"]');
}

/** Retired 2026-08-19: the SVG studio (HandoffDesignStudio) is deleted;
 *  the WebGL studio is the only canvas mount. */
export function handoffStudio(page: Page) {
  return page.getByTestId("handoff-design-studio");
}

/** Open the global command palette through the View menu. */
export async function openCommandPalette(page: Page) {
  await clickHeaderViewItem(page, "canvas-command-top");
  await expect(page.getByTestId("canvas-command-palette")).toBeVisible({
    timeout: 15_000,
  });
}

/** Open header View/More overflow, then click a menu item by test id. */
export async function clickHeaderViewItem(page: Page, testId: string) {
  const menu = page.getByTestId("header-view-menu");
  await expect(menu).toBeVisible({ timeout: 15_000 });
  await menu.click();
  await expect(page.getByTestId("header-view-menu-panel")).toBeVisible({
    timeout: 5_000,
  });
  const item = page.getByTestId(testId);
  await expect(item).toBeVisible({ timeout: 5_000 });
  // Portaled right-lane panels can sit under the View dropdown — force keeps
  // header toggles reliable without reverting lane layout.
  await item.click({ force: true });
}

/**
 * Canvas-first: instruments are summoned (peek / header / margin), not sticky.
 */
export async function summonCanvasInstruments(page: Page) {
  const dock = page.getByTestId("tool-dock");
  const strip = page.getByTestId("contextual-tool-strip");
  if ((await dock.count()) > 0 || (await strip.count()) > 0) return;
  const peek = page.getByTestId("instruments-peek");
  if ((await peek.count()) > 0) {
    await peek.click();
  } else {
    await clickHeaderViewItem(page, "pointer-settings-top");
  }
  await expect(dock.or(strip)).toBeVisible({ timeout: 10_000 });
}

/** Desktop left tool dock or phone bottom strip — summon first if idle. */
export async function expectToolDock(page: Page) {
  await summonCanvasInstruments(page);
  const dock = page.getByTestId("tool-dock");
  const strip = page.getByTestId("contextual-tool-strip");
  await expect(dock.or(strip)).toBeVisible({
    timeout: 15_000,
  });
}

/** Legacy studio layout (viewport under 960px) — matches rail tabs and counts. */
export const LEGACY_STUDIO_VIEWPORT = { width: 800, height: 900 };

/** Phone adaptive shell — triggers `data-layout="phone"` (≤720px). */
export const PHONE_STUDIO_VIEWPORT = { width: 390, height: 844 };

/** Fresh project with survey only — empty sketch for ghost bootstrap. */
export async function createSurveyProject(request: APIRequestContext) {
  const create = await request.post(`${API}/projects/`, {
    data: {
      address: "E2E Canvas AI, 42 Test Grove, Melbourne VIC 3000",
      lat: -37.8136,
      lng: 144.9631,
    },
  });
  expect(create.ok()).toBeTruthy();
  const body = (await create.json()) as { project: { id: string } };
  const projectId = body.project.id;

  const survey = await request.post(`${API}/projects/${projectId}/survey`);
  expect(survey.ok()).toBeTruthy();

  return { projectId };
}

/**
 * One tree (7.8 m), one pleached screen (3.5 m), one deck (0.5 m) and one flat
 * paver that must never grow a profile — the shared elevation fixture for the
 * silhouette and callout-hit probes.
 */
export async function seedElevationGarden(
  request: APIRequestContext,
  projectId: string,
) {
  const place = (symbol_id: string, x_pct: number, y_pct: number) => ({
    id: randomUUID(),
    symbol_id,
    x_pct,
    y_pct,
    rotation_deg: 0,
    scale: 1,
  });
  const res = await request.put(`${API}/projects/${projectId}/design-canvas`, {
    data: {
      placements: [
        place("curtis-tree-780", 30, 40),
        place("hornbeam-pleached", 55, 45),
        place("curtis-deck-050", 72, 60),
        place("bluestone-paver", 45, 72),
      ],
      strokes: [],
      irrigation_zones: [],
      site_frame: {
        boundary: [
          { x_pct: 20, y_pct: 15 },
          { x_pct: 80, y_pct: 15 },
          { x_pct: 80, y_pct: 85 },
          { x_pct: 20, y_pct: 85 },
        ],
        building: [
          { x_pct: 35, y_pct: 20 },
          { x_pct: 65, y_pct: 20 },
          { x_pct: 65, y_pct: 35 },
          { x_pct: 35, y_pct: 35 },
        ],
        building_source: "traced",
        easements: [],
        services: [],
        levels: [],
      },
    },
  });
  expect(res.ok()).toBeTruthy();
}

/**
 * Seed a pool placement with no barrier — triggers the required safety waiver
 * disclaimer (board-liability.ts: `poolUnbarriered = pools.length > 0 &&
 * barriers.length === 0`), so the share popup opens SafetyWaiverConfirm on
 * "Share new revision". Used by canvas-dialog-focus-trap.spec.ts to exercise
 * the nested-dialog Escape gating.
 */
export async function seedPoolWithoutBarrier(
  request: APIRequestContext,
  projectId: string,
) {
  // Merge onto any existing canvas — a wipe to pool-only leaves Share disabled
  // (no costed quote lines) and Playwright then burns the full test timeout.
  const existing = await request.get(
    `${API}/projects/${projectId}/design-canvas`,
  );
  expect(existing.ok()).toBeTruthy();
  const body = (await existing.json()) as {
    canvas?: {
      placements?: Array<Record<string, unknown>>;
      strokes?: unknown[];
    };
  };
  const prior = body.canvas?.placements ?? [];
  const res = await request.put(`${API}/projects/${projectId}/design-canvas`, {
    data: {
      placements: [
        ...prior,
        {
          id: randomUUID(),
          symbol_id: "pool",
          x_pct: 50,
          y_pct: 50,
          rotation_deg: 0,
          scale: 1,
        },
      ],
      strokes: body.canvas?.strokes ?? [],
    },
  });
  expect(res.ok()).toBeTruthy();
}

type SeedProjectOpts = {
  address: string;
  lat?: number;
  lng?: number;
  /** When true, seeds a costed placement so Quote is not empty. */
  seedCanvas?: boolean;
};

/** Create + survey (+ optional canvas seed) for Tier-1 / control e2e. */
export async function createAddressProject(
  request: APIRequestContext,
  opts: SeedProjectOpts,
) {
  const create = await request.post(`${API}/projects/`, {
    data: {
      address: opts.address,
      lat: opts.lat ?? -37.85,
      lng: opts.lng ?? 145.0,
    },
  });
  expect(create.ok()).toBeTruthy();
  const body = (await create.json()) as { project: { id: string } };
  const projectId = body.project.id;

  const survey = await request.post(`${API}/projects/${projectId}/survey`);
  expect(survey.ok()).toBeTruthy();

  if (opts.seedCanvas) {
    const seed = await request.put(
      `${API}/projects/${projectId}/design-canvas`,
      {
        data: {
          placements: [
            {
              id: randomUUID(),
              symbol_id: "bluestone-paver",
              x_pct: 42,
              y_pct: 48,
              rotation_deg: 0,
              scale: 1,
            },
          ],
          strokes: [],
        },
      },
    );
    expect(seed.ok()).toBeTruthy();
  }

  return { projectId };
}

export async function createWrightsTier1Project(
  request: APIRequestContext,
  opts: { seedCanvas?: boolean } = {},
) {
  return createAddressProject(request, {
    address: TIER1_WRIGHTS_ADDRESS,
    seedCanvas: opts.seedCanvas ?? true,
  });
}

export async function createCarltonControlProject(
  request: APIRequestContext,
  opts: { seedCanvas?: boolean } = {},
) {
  return createAddressProject(request, {
    address: TIER1_CONTROL_ADDRESS,
    lat: -37.8,
    lng: 144.96,
    seedCanvas: opts.seedCanvas ?? true,
  });
}

const DEFAULT_SCREENSHOT_DIR = path.join(
  __dirname,
  "artifacts",
  "camera-chrome-shots",
);

/** Persist a named camera-chrome screenshot outside Playwright's test-results. */
export async function takeScreenshot(
  page: Page,
  name: string,
  outDir: string = DEFAULT_SCREENSHOT_DIR,
) {
  fs.mkdirSync(outDir, { recursive: true });
  const dest = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: dest, fullPage: false });
  if (!fs.existsSync(dest)) {
    throw new Error(`screenshot missing after write: ${dest}`);
  }
}
