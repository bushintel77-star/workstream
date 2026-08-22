import { test, expect, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createAddressProject } from "./helpers";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

async function seedCanvas(projectId: string, request: APIRequestContext) {
  const res = await request.put(`${API}/projects/${projectId}/design-canvas`, {
    data: {
      placements: [
        {
          id: randomUUID(),
          symbol_id: "lophostemon-confertus",
          x_pct: 45,
          y_pct: 58,
          rotation_deg: 0,
          scale: 1,
        },
        {
          id: randomUUID(),
          symbol_id: "led-bollard-light",
          x_pct: 70,
          y_pct: 42,
          rotation_deg: 0,
          scale: 1,
        },
      ],
      strokes: [],
      features: [
        {
          id: randomUUID(),
          type: "LandscapeFeature",
          metadata: {
            layer: "hardscape",
            timestamp_created: new Date().toISOString(),
            source_attribution: "human_drawn",
            user_modification_state: "accepted",
          },
          geometry: {
            type: "Polygon",
            spatial_reference: "EPSG:3857",
            canvas_origin_pct: { x_pct: 0, y_pct: 0 },
            points: [
              { id: "a", pct: { x_pct: 35, y_pct: 60 } },
              { id: "b", pct: { x_pct: 60, y_pct: 60 } },
              { id: "c", pct: { x_pct: 60, y_pct: 75 } },
              { id: "d", pct: { x_pct: 35, y_pct: 75 } },
            ],
          },
          material_fill: {
            type: "surface",
            sku: "bluestone-paver",
            depth_m: 0.06,
            waste_allocation_pct: 10,
          },
        },
      ],
      irrigation_zones: [
        {
          id: randomUUID(),
          name: "Lawn south",
          kind: "spray",
          emitter_spacing_cm: 30,
          emitter_flow_lph: 2.2,
          points: [
            { x_pct: 22, y_pct: 62 },
            { x_pct: 42, y_pct: 62 },
            { x_pct: 42, y_pct: 80 },
          ],
        },
      ],
      construction_trenches: [
        {
          id: randomUUID(),
          name: "Drain spine",
          kind: "drainage",
          source: "traced",
          depth_mm: 450,
          points: [
            { x_pct: 25, y_pct: 48 },
            { x_pct: 50, y_pct: 58 },
          ],
        },
      ],
      site_frame: {
        boundary: [
          { x_pct: 15, y_pct: 12 },
          { x_pct: 85, y_pct: 12 },
          { x_pct: 85, y_pct: 88 },
          { x_pct: 15, y_pct: 88 },
        ],
        building: [
          { x_pct: 35, y_pct: 20 },
          { x_pct: 65, y_pct: 20 },
          { x_pct: 65, y_pct: 34 },
          { x_pct: 35, y_pct: 34 },
        ],
        building_source: "traced",
        easements: [],
        services: [],
        levels: [
          { x_pct: 24, y_pct: 26, z_m: 100.5, source: "authored" },
          { x_pct: 70, y_pct: 70, z_m: 99.9, source: "vicmap_contour" },
        ],
      },
    },
  });
  expect(res.ok()).toBeTruthy();
}

test.describe("WebGL communication modes", () => {
  test.setTimeout(180_000);

  test("Survey default is technical and switch keeps data references stable", async ({
    page,
    request,
  }) => {
    const { projectId } = await createAddressProject(request, {
      address: "4 Communication Test Street, Prahran VIC 3181",
    });
    await seedCanvas(projectId, request);

    await page.goto(`/projects/${projectId}?mode=survey`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("survey-communication-card")).toBeVisible();
    await expect(
      page.getByTestId("survey-communication-mode-technical"),
    ).toHaveAttribute("aria-pressed", "true");

    const firstBoundary = page.getByTestId("annotation-boundary-label").first();
    await expect(firstBoundary).toBeVisible();
    const baseline = (await firstBoundary.textContent())?.trim();

    await page.getByTestId("survey-communication-mode-architectural").click();
    await expect(
      page.getByTestId("survey-communication-mode-architectural"),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(firstBoundary).toHaveText(baseline ?? "");
  });

  test("CAD and Sketch mode defaults are architectural and creative", async ({
    page,
    request,
  }) => {
    const { projectId } = await createAddressProject(request, {
      address: "5 CAD Sketch Communication Street, Prahran VIC 3181",
    });
    await seedCanvas(projectId, request);

    await page.goto(`/projects/${projectId}?mode=cad`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("survey-communication-card")).toBeVisible();
    await expect(
      page.getByTestId("survey-communication-mode-architectural"),
    ).toHaveAttribute("aria-pressed", "true");

    await page.goto(`/projects/${projectId}?mode=sketch`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("survey-communication-card")).toBeVisible();
    await expect(
      page.getByTestId("survey-communication-mode-creative"),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("survey-communication-mode-technical").click();
    await expect(
      page.getByTestId("survey-communication-mode-technical"),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("trade packs toggle legend and overlays", async ({ page, request }) => {
    const { projectId } = await createAddressProject(request, {
      address: "6 Trade Communication Street, Prahran VIC 3181",
    });
    await seedCanvas(projectId, request);

    await page.goto(`/projects/${projectId}?mode=survey`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("trade-pack-irrigationDrainage")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator('[data-testid="trade-callout-irrigationDrainage"]').first()).toBeVisible();
    await expect(
      page.locator('[data-testid="trade-callout-hardscapeConstruction"]').first(),
    ).toBeVisible();
    await expect(
      page
        .getByTestId("survey-communication-legend")
        .getByText("Irrigation and drainage"),
    ).toBeVisible();
    await page.getByTestId("trade-pack-lightingElectrical").click();
    await expect(page.getByTestId("trade-pack-lightingElectrical")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(
      page.locator('[data-testid="trade-callout-lightingElectrical"]').first(),
    ).toBeVisible();
    await expect(
      page
        .getByTestId("survey-communication-legend")
        .getByText("Lighting electrical"),
    ).toBeVisible();

    await page.getByTestId("trade-pack-irrigationDrainage").click();
    await expect(page.getByTestId("trade-pack-irrigationDrainage")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(page.locator('[data-testid="trade-callout-irrigationDrainage"]')).toHaveCount(
      0,
    );
  });
});
