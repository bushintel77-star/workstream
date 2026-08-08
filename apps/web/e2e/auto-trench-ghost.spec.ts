import { expect, test } from "@playwright/test";
import {
  createSurveyProject,
  handoffStudio,
  openCommandPalette,
} from "./helpers";

const API = process.env.API_URL ?? "http://localhost:3001";

/**
 * Auto trench… → ghost polylines → Accept (not propose-services).
 * Dig gate unlocked via seeded site_pack.dig_override_at.
 */
test.describe("Auto trench ghost", () => {
  test("seeded drip zone proposes ghosts; Accept commits trenches", async ({
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
          irrigation_zones: [
            {
              id: "00000000-0000-4000-8000-000000000001",
              name: "Zone 1",
              kind: "drip",
              points: [
                { x_pct: 20, y_pct: 40 },
                { x_pct: 40, y_pct: 40 },
                { x_pct: 55, y_pct: 55 },
              ],
              emitter_spacing_cm: 30,
              emitter_flow_lph: 2,
            },
          ],
          construction_trenches: [],
          site_frame: {
            boundary: [
              { x_pct: 10, y_pct: 10 },
              { x_pct: 90, y_pct: 10 },
              { x_pct: 90, y_pct: 90 },
              { x_pct: 10, y_pct: 90 },
            ],
            building: [
              { x_pct: 30, y_pct: 20 },
              { x_pct: 50, y_pct: 20 },
              { x_pct: 50, y_pct: 35 },
              { x_pct: 30, y_pct: 35 },
            ],
            easements: [],
            services: [],
            levels: [],
            site_pack: {
              chase: [],
              dig_override_at: "2026-01-01T00:00:00.000Z",
            },
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

    await openCommandPalette(page);
    await page.getByLabel("Search assets").fill("auto trench");
    await page.getByTestId("canvas-command-auto-trench").click();

    await expect(page.getByTestId("trench-ghost-review")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("trench-overlay")).toBeVisible();
    await expect(
      page.locator('[data-testid="trench-path-irrig_lateral"][data-ghost="true"]'),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.locator('[data-testid="trench-path-irrig_main"][data-ghost="true"]'),
    ).toBeVisible();

    // Distinct from landscape-services propose path (zone-path-lighting_conduit).
    await expect(page.getByTestId("zone-path-lighting_conduit")).toHaveCount(0);

    await page.getByTestId("trench-accept-all").click();
    await expect(page.getByTestId("trench-ghost-review")).toHaveCount(0);
    await expect(
      page.locator('[data-testid^="trench-path-"][data-ghost="true"]'),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-testid="trench-path-irrig_lateral"][data-ghost="false"]'),
    ).toBeVisible({ timeout: 5_000 });

    // Persist: wait for autosave, then assert construction_trenches are live.
    await expect
      .poll(
        async () => {
          const res = await request.get(
            `${API}/projects/${projectId}/design-canvas`,
          );
          if (!res.ok()) return 0;
          const body = (await res.json()) as {
            canvas?: {
              construction_trenches?: Array<{ ghost?: boolean; kind: string }>;
            };
          };
          const trenches = body.canvas?.construction_trenches ?? [];
          const live = trenches.filter((t) => !t.ghost);
          const kinds = new Set(live.map((t) => t.kind));
          return kinds.has("irrig_main") && kinds.has("irrig_lateral")
            ? live.length
            : 0;
        },
        { timeout: 20_000 },
      )
      .toBeGreaterThan(0);
  });
});
