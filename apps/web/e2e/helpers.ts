import { randomUUID } from "node:crypto";
import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";

const API = process.env.API_URL ?? "http://localhost:3001";

/** Canonical Tier-1 Wrights address (proposal v3 / workbook lock). */
export const TIER1_WRIGHTS_ADDRESS =
  "36 Wrights Terrace, Prahran VIC 3181";

/** Control site that must never unlock Tier-1 surfaces. */
export const TIER1_CONTROL_ADDRESS = "3 Test St, Carlton VIC 3053";

/** Legacy pipeline chrome — must stay absent on canvas-first routes. */
export function pipelineShell(page: Page) {
  return page.locator('[data-testid="project-pipeline-shell"]');
}

/** Live HandoffDesignStudio root (replaces retired site-canvas). */
export function handoffStudio(page: Page) {
  return page.getByTestId("handoff-design-studio");
}

/** Open the global command palette through its visible user control. */
export async function openCommandPalette(page: Page) {
  const trigger = page.getByTestId("canvas-command-top");
  await expect(trigger).toBeVisible({ timeout: 15_000 });
  await trigger.click();
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
    await page.getByTestId("pointer-settings-top").click({ force: true });
  }
  await expect(dock.or(strip)).toBeVisible({ timeout: 10_000 });
}

/** Desktop left tool dock — summon first if idle parchment. */
export async function expectToolDock(page: Page) {
  await summonCanvasInstruments(page);
  await expect(page.getByTestId("tool-dock")).toBeVisible({
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
