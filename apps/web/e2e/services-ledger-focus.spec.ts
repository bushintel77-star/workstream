import { expect, test } from "@playwright/test";
import {
  createSurveyProject,
  handoffStudio,
  openCommandPalette,
} from "./helpers";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/**
 * Services ledger — open, tick visibility, focus isolate, clear.
 * Hard asserts only; seed guarantees rows (no soft isVisible early-out).
 */
test.describe("Services ledger focus", () => {
  test("open ledger, tick + focus row, clear restores board", async ({
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
              id: "11111111-1111-4111-8111-111111111111",
              name: "Path lights",
              kind: "lighting",
              points: [
                { x_pct: 20, y_pct: 60 },
                { x_pct: 60, y_pct: 60 },
              ],
              emitter_spacing_cm: 30,
              emitter_flow_lph: 2,
              fixture_spacing_m: 2.5,
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
              { x_pct: 30, y_pct: 20 },
              { x_pct: 55, y_pct: 20 },
              { x_pct: 55, y_pct: 45 },
              { x_pct: 30, y_pct: 45 },
            ],
            easements: [
              [
                { x_pct: 70, y_pct: 10 },
                { x_pct: 92, y_pct: 10 },
                { x_pct: 92, y_pct: 35 },
                { x_pct: 70, y_pct: 35 },
                { x_pct: 70, y_pct: 10 },
              ],
            ],
            services: [
              [
                { x_pct: 20, y_pct: 70 },
                { x_pct: 55, y_pct: 72 },
                { x_pct: 80, y_pct: 68 },
              ],
            ],
            levels: [{ x_pct: 30, y_pct: 40, z_m: 42.15 }],
          },
        },
      },
    );
    expect(seed.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}?svg=1&mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("cad-plan-board")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("easement-hatch").first()).toBeVisible({
      timeout: 15_000,
    });

    await openCommandPalette(page);
    await page.getByLabel("Search assets").fill("services ledger");
    await page.getByTestId("canvas-command-services-ledger").click();

    const ledger = page.getByTestId("services-ledger");
    await expect(ledger).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("right-data-lane-services")).toBeVisible();
    await expect(page.getByTestId("services-ledger-live")).toContainText(
      /mapped features/i,
    );

    const corridorRow = page.getByTestId("services-ledger-row-corridor");
    await expect(corridorRow).toBeVisible({ timeout: 5_000 });
    const corridorLi = corridorRow.locator("xpath=ancestor::li[1]");
    await expect(corridorLi).toHaveAttribute("data-focused", "false");

    await corridorRow.click();
    await expect(corridorLi).toHaveAttribute("data-focused", "true");
    await expect(page.getByTestId("studio-context-breadcrumb")).toContainText(
      /Isolated:\s*Services/i,
    );

    // Non-focused easement dims under services isolation.
    const easement = page.getByTestId("easement-hatch").first();
    await expect(easement).toBeVisible();
    await expect
      .poll(async () => {
        const opacity = await easement.evaluate((el) => {
          const g = el.closest("g") ?? el;
          return Number.parseFloat(getComputedStyle(g).opacity || "1");
        });
        return opacity;
      })
      .toBeLessThan(0.5);

    const tick = corridorLi.locator('input[type="checkbox"]');
    await expect(tick).toBeChecked();
    await tick.uncheck();
    await expect(corridorLi).toHaveAttribute("data-hidden", "true");
    await expect(page.getByTestId("utility-service-trace")).toHaveCount(0);

    await page.getByTestId("services-ledger-show-all").click();
    await expect(corridorLi).toHaveAttribute("data-hidden", "false");
    await expect(page.getByTestId("utility-service-trace").first()).toBeVisible({
      timeout: 5_000,
    });

    await page.getByTestId("services-ledger-clear-focus").click();
    await expect(corridorLi).toHaveAttribute("data-focused", "false");
    // Breadcrumb unmounts when no isolation segments remain.
    await expect(
      page.getByTestId("studio-context-breadcrumb").getByText(/Isolated:\s*Services/i),
    ).toHaveCount(0);
    await expect
      .poll(async () => {
        const opacity = await easement.evaluate((el) => {
          const g = el.closest("g") ?? el;
          return Number.parseFloat(getComputedStyle(g).opacity || "1");
        });
        return opacity;
      })
      .toBeGreaterThan(0.8);
  });
});
