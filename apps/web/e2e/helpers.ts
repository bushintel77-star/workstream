import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";

const API = process.env.API_URL ?? "http://localhost:3001";

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

/** Drawing tools live in the fixed left tool dock — always visible in plan modes. */
export async function expectToolDock(page: Page) {
  await expect(page.getByTestId("tool-dock")).toBeVisible({
    timeout: 15_000,
  });
}

/** @deprecated Prefer expectToolDock — instruments are no longer margin-summoned. */
export async function summonCanvasInstruments(page: Page) {
  await expectToolDock(page);
}

/** Legacy studio layout (viewport under 960px) — matches rail tabs and counts. */
export const LEGACY_STUDIO_VIEWPORT = { width: 800, height: 900 };

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
