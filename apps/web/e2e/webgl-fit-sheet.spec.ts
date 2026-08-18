import { test, expect, type ConsoleMessage } from "@playwright/test";
import { createAddressProject } from "./helpers";
import { randomUUID } from "node:crypto";

/** Prefer 127.0.0.1 — `localhost` can resolve to ::1 while the API binds IPv4. */
const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/**
 * Itemized Fit-Sheet e2e (Gap 5 / Phase 3 live quote).
 *
 * Seeds real catalog placements (tree + hedge + paving) via the canvas PUT —
 * the same channel as studio autosave — then verifies the WebGL studio's
 * live quotation card:
 *
 *   1. The Quote chip appears (items exist) and the card is open by default.
 *   2. The card carries itemized line rows with $ figures and the section
 *      chips, plus the Subtotal/GST/Total summary.
 *   3. Stock pulse chips render (IN STOCK / LOW STOCK / AI EST).
 *   4. The Quote chip toggles the card off and back on.
 *   5. No fatal console errors.
 */

test.describe("WebGL itemized fit-sheet (live quote)", () => {
  test("placements drive a live itemized quotation card", async ({
    page,
    request,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg: ConsoleMessage) => {
      if (msg.type() === "error") errors.push(msg.text().slice(0, 300));
    });
    page.on("pageerror", (err: Error) =>
      errors.push(`${err.name}: ${err.message.slice(0, 300)}`),
    );

    const { projectId } = await createAddressProject(request, {
      address: "1 Fit Sheet Street, Melbourne VIC 3000",
    });

    const place = (symbol_id: string, x_pct: number, y_pct: number) => ({
      id: randomUUID(),
      symbol_id,
      x_pct,
      y_pct,
      rotation_deg: 0,
      scale: 1,
    });

    const seed = await request.put(
      `${API}/projects/${projectId}/design-canvas`,
      {
        data: {
          placements: [
            place("olive-standard", 40, 40),
            place("hornbeam-pleached", 60, 45),
            place("bluestone-paver", 45, 60),
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
      },
    );
    expect(seed.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}?webgl=1`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(4000);

    await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
      timeout: 10_000,
    });

    // 1. The estimation is a docked companion — visible in ANY mode
    // (estimation-dock spec §3). The Fit tab owns the toggle; the rail
    // quote tool is gone (one affordance per state).
    const card = page.locator('[data-testid="fit-sheet-card"]');
    await expect(card).toBeVisible({ timeout: 8_000 });
    const fitTab = page.getByTestId("meta-tab-fit");
    await expect(fitTab).toHaveAttribute("aria-pressed", "true");

    // 2. Itemized rows with money figures + section chips + summary.
    const lines = page.locator('[data-testid="fit-sheet-lines"] > div');
    await expect(lines.first()).toBeVisible();
    expect(await lines.count()).toBeGreaterThanOrEqual(1);
    await expect(card).toContainText(/\$/);
    await expect(page.locator('[data-testid="fit-sheet-sections"]')).toBeVisible();
    const total = page.locator('[data-testid="fit-sheet-total"]');
    await expect(total).toBeVisible();
    await expect(total).toContainText(/\$[\d,]+\.\d{2}/);

    // 3. Stock pulse chips render on trade-matched lines.
    const stockChips = page.locator('[data-testid="fit-sheet-stock-chip"]');
    await expect(stockChips.first()).toBeVisible({ timeout: 5_000 });

    // 4. Untick a line — the total drops, the row strikes through in the
    // excluded block; re-tick restores (the design stays on canvas).
    const totalFigure = (await total.innerText()).match(/\$[\d,]+\.\d{2}/)?.[0];
    expect(totalFigure).toBeDefined();
    const firstTick = page.locator('[data-testid^="fit-line-tick-"]').first();
    const firstTickId = await firstTick.getAttribute("data-testid");
    expect(firstTickId).not.toBeNull();
    await firstTick.click();
    await expect(page.locator('[data-testid="fit-sheet-excluded"]')).toBeVisible({
      timeout: 8_000,
    });
    await expect(page.locator('[data-testid^="fit-line-excluded-"]').first()).toBeVisible();
    await expect(total).not.toContainText(totalFigure!);
    // Re-tick the SAME line (it now lives in the excluded block under the
    // same testid — the report's first tick is a different line now).
    await page.getByTestId(firstTickId!).click();
    await expect(page.locator('[data-testid="fit-sheet-excluded"]')).toHaveCount(0);
    await expect(total).toContainText(totalFigure!);

    // 5. Toggle off / on via the Fit tab.
    await fitTab.click();
    await expect(card).toHaveCount(0);
    await fitTab.click();
    await expect(card).toBeVisible();

    // 6. No fatal console errors.
    const fatal = errors.filter(
      (e) =>
        e.includes("Maximum update depth") ||
        e.includes("TypeError") ||
        e.includes("ReferenceError"),
    );
    expect(fatal, `Fatal console errors:\n${fatal.join("\n")}`).toHaveLength(0);
  });
});
