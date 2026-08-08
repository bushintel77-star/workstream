import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import {
  clickHeaderViewItem,
  createSurveyProject,
  handoffStudio,
} from "./helpers";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

async function seedDesignCanvas(request: APIRequestContext, projectId: string) {
  const seed = await request.put(`${API}/projects/${projectId}/design-canvas`, {
    data: {
      placements: [
        {
          id: "99999999-9999-4999-8999-999999999999",
          symbol_id: "lawn",
          x_pct: 50,
          y_pct: 50,
          rotation_deg: 0,
          scale: 1,
        },
      ],
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
        easements: [],
        services: [],
        levels: [],
        drainage_runs: [],
      },
    },
  });
  expect(seed.ok()).toBeTruthy();
}

async function openQuote(page: Page, projectId: string) {
  await page.goto(`/projects/${projectId}?mode=cad`);
  await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
  await clickHeaderViewItem(page, "live-cost-top");
  await expect(page.getByTestId("live-cost-rail")).toBeVisible({
    timeout: 15_000,
  });
  // Expand the rail to the full QuoteBuilder table view.
  await page.getByTestId("live-cost-rail-expand").click();
  await expect(page.getByTestId("quote-surface")).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("Quote line items", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("desktop quote shows sections, line rows, totals and supports qty/rate edits", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await seedDesignCanvas(request, projectId);
    await openQuote(page, projectId);

    await expect(page.getByTestId("quote-surface")).toBeVisible();
    await expect(page.getByTestId("quote-totals-bar")).toBeVisible();
    await expect(page.getByText("Total incl GST")).toBeVisible();

    // The QuoteBuilder loads the quote doc + waits for estimate to settle.
    // In the rail flow this starts after expand click, so allow more time.
    const firstRow = page.locator('[data-testid^="quote-line-"]').first();
    await expect(firstRow).toBeVisible({ timeout: 30_000 });

    // Section summary includes line count and a subtotal.
    const firstSection = page.locator("details").first();
    await expect(firstSection).toBeVisible();
    await expect(firstSection.locator("summary")).toContainText(/\d+ line/);

    // Desktop line row exposes qty/rate inputs.
    const firstQty = firstRow.locator('input[aria-label$="quantity"]').first();
    const firstRate = firstRow.locator('input[aria-label$="rate"]').first();
    await expect(firstQty).toBeVisible();
    await expect(firstRate).toBeVisible();

    // Edit qty and confirm the row re-renders and the save status appears.
    await firstQty.fill("999");
    await firstQty.blur();
    await expect(firstQty).toHaveValue("999");
    await expect(page.getByTestId("quote-save-status")).toBeVisible({
      timeout: 5_000,
    });
  });
});

test.describe("Quote line items mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("mobile quote shows a card row and opens the edit drawer", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await seedDesignCanvas(request, projectId);
    await openQuote(page, projectId);

    await expect(page.getByTestId("quote-surface")).toBeVisible();

    // The QuoteBuilder loads the quote doc + waits for estimate to settle.
    const firstRow = page.locator('[data-testid^="quote-line-"]').first();
    await expect(firstRow).toBeVisible({ timeout: 30_000 });

    // Tap the mobile card to open the edit drawer.
    await firstRow.locator("button").first().click();
    const drawer = page.getByTestId("quote-line-drawer");
    await expect(drawer).toBeVisible();

    // Drawer exposes qty/rate/notes inputs and a Done button.
    await expect(drawer.locator("text=Qty")).toBeVisible();
    await expect(drawer.locator("text=Rate")).toBeVisible();
    await expect(drawer.locator("text=Notes")).toBeVisible();
    await expect(drawer.locator("button:has-text('Done')")).toBeVisible();

    await drawer.locator("button:has-text('Done')").click();
    await expect(drawer).toHaveCount(0);
  });
});
