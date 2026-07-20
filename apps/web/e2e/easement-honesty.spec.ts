import { expect, test } from "@playwright/test";
import {
  handoffStudio,
  LEGACY_STUDIO_VIEWPORT,
  summonCanvasInstruments,
} from "./helpers";

const API = process.env.API_URL ?? "http://localhost:3001";

const EASEMENT_RING = [
  { x_pct: 70, y_pct: 10 },
  { x_pct: 92, y_pct: 10 },
  { x_pct: 92, y_pct: 35 },
  { x_pct: 70, y_pct: 35 },
  { x_pct: 70, y_pct: 10 },
];

test.describe("Easement honesty loop", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(LEGACY_STUDIO_VIEWPORT);
  });

  test("seeded site_frame easement hatches and survives reload", async ({
    page,
    request,
  }) => {
    const create = await request.post(`${API}/projects/`, {
      data: {
        address: "E2E Easement, 9 Hatch Lane, Melbourne VIC 3000",
        lat: -37.8136,
        lng: 144.9631,
      },
    });
    expect(create.ok()).toBeTruthy();
    const body = (await create.json()) as { project: { id: string } };
    const projectId = body.project.id;

    const survey = await request.post(`${API}/projects/${projectId}/survey`);
    expect(survey.ok()).toBeTruthy();

    const seed = await request.put(
      `${API}/projects/${projectId}/design-canvas`,
      {
        data: {
          placements: [],
          strokes: [],
          irrigation_zones: [],
          site_frame: {
            boundary: [
              { x_pct: 15, y_pct: 12 },
              { x_pct: 85, y_pct: 12 },
              { x_pct: 85, y_pct: 88 },
              { x_pct: 15, y_pct: 88 },
            ],
            building: [
              { x_pct: 30, y_pct: 20 },
              { x_pct: 55, y_pct: 20 },
              { x_pct: 55, y_pct: 45 },
              { x_pct: 30, y_pct: 45 },
            ],
            easements: [EASEMENT_RING],
            services: [
              [
                { x_pct: 20, y_pct: 70 },
                { x_pct: 55, y_pct: 72 },
                { x_pct: 80, y_pct: 68 },
              ],
            ],
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
    await expect(page.getByTestId("easement-hatch").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("easement-honesty-footer")).toBeVisible();
    await expect(page.getByTestId("utility-service-trace").first()).toBeVisible();
    await expect(page.getByTestId("utility-honesty-footer")).toBeVisible();

    await page.reload();
    await expect(page.getByTestId("easement-hatch").first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("easement-honesty-footer")).toBeVisible();
    await expect(page.getByTestId("utility-honesty-footer")).toBeVisible();
  });

  test("survey Servc ≥3 pts commits easement hatch on CAD", async ({
    page,
    request,
  }) => {
    const create = await request.post(`${API}/projects/`, {
      data: {
        address: "E2E Draw Easement, 11 Trace Rd, Melbourne VIC 3000",
        lat: -37.8136,
        lng: 144.9631,
      },
    });
    expect(create.ok()).toBeTruthy();
    const body = (await create.json()) as { project: { id: string } };
    const projectId = body.project.id;

    const survey = await request.post(`${API}/projects/${projectId}/survey`);
    expect(survey.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}?mode=survey`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("survey-annotation-layer")).toBeVisible({
      timeout: 15_000,
    });

    await summonCanvasInstruments(page);
    await page.getByTestId("canvas-tool-service").click();
    const layer = page.getByTestId("survey-annotation-layer");
    await expect(layer).toHaveAttribute("data-capturing", "true");
    const box = await layer.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;

    const clickPct = async (xPct: number, yPct: number) => {
      await page.mouse.click(
        box.x + (box.width * xPct) / 100,
        box.y + (box.height * yPct) / 100,
      );
    };

    await clickPct(40, 40);
    await clickPct(60, 40);
    await clickPct(60, 60);
    await clickPct(40, 60);
    await expect(page.getByTestId("survey-service-hint")).toContainText("4 pts");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("survey-service-hint")).toHaveCount(0);

    await expect(page.getByTestId("autosave-tick")).toHaveAttribute(
      "data-status",
      "saved",
      { timeout: 15_000 },
    );

    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(page.getByTestId("cad-plan-board")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("easement-hatch").first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("easement-honesty-footer")).toBeVisible();
  });
});
