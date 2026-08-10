import { expect, test, type Locator } from "@playwright/test";
import {
  createSurveyProject,
  handoffStudio,
  openCommandPalette,
} from "./helpers";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

async function minBox(el: Locator): Promise<{ w: number; h: number }> {
  const box = await el.boundingBox();
  expect(box, "control must be laid out").toBeTruthy();
  return { w: box!.width, h: box!.height };
}

/**
 * CAD AI §5.4 — Instant Planner chrome stays ≥44px and thumb-reachable under
 * phone / on-site density (data-density=onsite).
 */
test.describe("Instant Planner onsite density", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("phone density stamps onsite and keeps taps ≥44px", async ({
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
    const studio = handoffStudio(page);
    await expect(studio).toBeVisible({ timeout: 30_000 });
    await expect(studio).toHaveAttribute("data-density", "onsite", {
      timeout: 10_000,
    });
    await expect(studio).toHaveAttribute("data-compact", "1");

    await expect(page.getByTestId("instant-planner-chrome")).toBeVisible({
      timeout: 20_000,
    });

    const marker = page.locator('[data-testid^="hero-marker-"]').first();
    await expect(marker).toBeVisible({ timeout: 20_000 });
    const markerBox = await minBox(marker);
    expect(markerBox.w).toBeGreaterThanOrEqual(44);
    expect(markerBox.h).toBeGreaterThanOrEqual(44);

    await marker.click();
    await expect(page.getByTestId("hero-detail-overlay")).toBeVisible();
    const freeze = page.getByTestId("hero-freeze");
    await expect(freeze).toBeVisible();
    const freezeBox = await minBox(freeze);
    expect(freezeBox.h).toBeGreaterThanOrEqual(44);
    await page.getByTestId("hero-back-to-plan").click();
    await expect(page.getByTestId("hero-detail-overlay")).toBeHidden();

    await openCommandPalette(page);
    await page.getByLabel("Search assets").fill("instant planner assist");
    await page.getByTestId("canvas-command-planner-assist").click();
    const assist = page.getByTestId("studio-assist-panel");
    await expect(assist).toBeVisible();

    const assistBox = await assist.boundingBox();
    expect(assistBox, "assist panel laid out").toBeTruthy();
    // Thumb band: assist docks to the lower half of a phone viewport.
    expect(assistBox!.y + assistBox!.height).toBeGreaterThan(844 * 0.45);

    const irrigate = page.getByTestId("assist-irrigation");
    await expect(irrigate).toBeVisible();
    const irrigBox = await minBox(irrigate);
    expect(irrigBox.h).toBeGreaterThanOrEqual(44);

    // Dismiss assist so the phone sheet FAB is free, then open Instant Planner.
    await page.keyboard.press("Escape");
    await page.getByTestId("studio-primary-fab").click();
    await page.getByTestId("studio-sheet-tab-data").click();
    await expect(page.getByTestId("studio-sheet-live-bom")).toBeVisible();
    const addQuote = page.getByTestId("instant-planner-add-to-main-quote");
    await expect(addQuote).toBeVisible({ timeout: 15_000 });
    const quoteBox = await minBox(addQuote);
    expect(quoteBox.h).toBeGreaterThanOrEqual(44);
  });
});
