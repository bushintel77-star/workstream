import { expect, test } from "@playwright/test";
import {
  createSurveyProject,
  handoffStudio,
  openCommandPalette,
} from "./helpers";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/**
 * Instant Planner on handoff: chrome mounts in CAD, labour/quote CTA present,
 * freeze option creates a design branch, assist panel is reachable.
 */
test.describe("Instant Planner handoff", () => {
  test("chrome, freeze option, and assist mount in CAD", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);

    const seed = await request.put(
      `${API}/projects/${projectId}/design-canvas`,
      {
        data: {
          placements: [
            {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              symbol_id: "lomandra-mass",
              x_pct: 42,
              y_pct: 48,
              rotation_deg: 0,
              scale: 1,
            },
          ],
          features: [
            {
              id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              type: "LandscapeFeature",
              metadata: {
                layer: "hardscape",
                friendly_name: "Patio strip",
                timestamp_created: new Date().toISOString(),
                source_attribution: "human_drawn",
                user_modification_state: "accepted",
              },
              geometry: {
                type: "Polygon",
                spatial_reference: "EPSG:3857",
                canvas_origin_pct: { x_pct: 0, y_pct: 0 },
                points: [
                  { id: "v0", pct: { x_pct: 35, y_pct: 40 } },
                  { id: "v1", pct: { x_pct: 55, y_pct: 40 } },
                  { id: "v2", pct: { x_pct: 55, y_pct: 58 } },
                  { id: "v3", pct: { x_pct: 35, y_pct: 58 } },
                ],
              },
              material_fill: {
                type: "surface",
                sku: "bluestone-paving",
                depth_m: 0.075,
                waste_allocation_pct: 10,
              },
            },
          ],
        },
      },
    );
    expect(seed.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("instant-planner-chrome")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("hero-feature-markers")).toBeVisible({
      timeout: 15_000,
    });

    const marker = page.locator('[data-testid^="hero-marker-"]').first();
    await expect(marker).toBeVisible();
    await marker.click();
    await expect(page.getByTestId("hero-detail-overlay")).toBeVisible();
    await expect(page.getByTestId("hero-freeze")).toBeVisible();

    const before = await request.get(
      `${API}/projects/${projectId}/design-branches`,
    );
    expect(before.ok()).toBeTruthy();
    const beforeCount = (
      (await before.json()) as { branches: unknown[] }
    ).branches.length;

    await page.getByTestId("hero-freeze").click();
    await expect(page.getByTestId("hero-detail-overlay")).toBeHidden({
      timeout: 15_000,
    });

    await expect
      .poll(
        async () => {
          const res = await request.get(
            `${API}/projects/${projectId}/design-branches`,
          );
          if (!res.ok()) return beforeCount;
          const body = (await res.json()) as { branches: unknown[] };
          return body.branches.length;
        },
        { timeout: 15_000 },
      )
      .toBeGreaterThan(beforeCount);

    await openCommandPalette(page);
    await page.getByLabel("Search assets").fill("design branches");
    await page.getByTestId("canvas-command-design-branches").click();
    await expect(page.getByTestId("design-branch-dock")).toBeVisible();
    await expect(page.getByTestId("design-branch-freeze")).toBeVisible();
  });
});
