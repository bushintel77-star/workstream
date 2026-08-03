import { expect, test } from "@playwright/test";
import {
  createSurveyProject,
  handoffStudio,
  seedElevationGarden,
} from "./helpers";

/**
 * Garden elevation silhouettes (Tier 4).
 *
 * The elevation board, the fit-sheet strip and the plan thumbnail must all draw
 * the *placed symbol's* real family and mature height. If any surface regresses
 * to a plain rectangle or the coarse studio height, `data-elev-family` counts
 * here collapse — that is the whole point of this probe.
 */

/**
 * One tree (7.8 m), one pleached screen (3.5 m), one deck (0.5 m) and one flat
 * paver that must never grow a profile.
 */
async function seedGarden(request: APIRequestContext, projectId: string) {
  const place = (symbol_id: string, x_pct: number, y_pct: number) => ({
    id: randomUUID(),
    symbol_id,
    x_pct,
    y_pct,
    rotation_deg: 0,
    scale: 1,
  });
  const res = await request.put(`${API}/projects/${projectId}/design-canvas`, {
    data: {
      placements: [
        place("curtis-tree-780", 30, 40),
        place("hornbeam-pleached", 55, 45),
        place("curtis-deck-050", 72, 60),
        place("bluestone-paver", 45, 72),
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
  });
  expect(res.ok()).toBeTruthy();
}

test.describe("Garden elevation silhouettes", () => {
  test("elevation board draws real families, named callouts and no profile for flat surfaces", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await seedElevationGarden(request, projectId);

    await page.goto(`/projects/${projectId}?mode=elevation`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
    const board = page.getByTestId("elevation-profile");
    await expect(board).toBeVisible({ timeout: 20_000 });

    // Textures are mounted, so `textured` glyph fills resolve to real defs.
    await expect(page.getByTestId("elevation-texture-defs")).toHaveCount(1);

    const bars = board.locator('[data-layer="vegetation"] [data-elev-family]');
    // Three standing assets — the bluestone paver has no vertical presence.
    await expect(bars).toHaveCount(3);
    await expect(
      board.locator('[data-layer="vegetation"] [data-elev-family="tree"]'),
    ).toHaveCount(1);
    await expect(
      board.locator('[data-layer="vegetation"] [data-elev-family="screen"]'),
    ).toHaveCount(1);
    await expect(
      board.locator('[data-layer="vegetation"] [data-elev-family="deck"]'),
    ).toHaveCount(1);
    await expect(
      board.locator('[data-layer="vegetation"] [data-elev-family="plain"]'),
    ).toHaveCount(0);

    /*
     * Callouts carry the *placed symbol's* mature height, not the coarse studio
     * type (canopy 6 m, hedge 1.2 m, deck 0.4 m). Seeing 7.8 / 3.5 / 0.5 m is
     * the proof that the domain projection is wired through.
     */
    for (const m of ["7.8 m", "3.5 m", "0.5 m"]) {
      await expect(
        page.getByTestId("elevation-label").filter({ hasText: m }),
      ).toHaveCount(1);
    }

    // A 7.8 m tree must stand taller on the datum than a 0.5 m deck.
    const treeBox = await board
      .locator('[data-layer="vegetation"] [data-elev-family="tree"]')
      .boundingBox();
    const deckBox = await board
      .locator('[data-layer="vegetation"] [data-elev-family="deck"]')
      .boundingBox();
    expect(treeBox).toBeTruthy();
    expect(deckBox).toBeTruthy();
    expect(treeBox!.height).toBeGreaterThan(deckBox!.height * 3);
    // …and overtop the dwelling eave on the same datum.
    const bld = await board.locator('[data-layer="building"] rect').boundingBox();
    expect(bld).toBeTruthy();
    expect(treeBox!.y).toBeLessThan(bld!.y);

    /*
     * Selecting a profile previews the same silhouette in the plan thumbnail.
     * The thumbnail title is the untruncated species name — board callouts are
     * deliberately shortened (`shortenElevationTag`).
     *
     * Click the silhouette here — this probe owns the geometry. Callout clicks
     * are covered separately by e2e/elevation-callout-hit.spec.ts.
     */
    await expect(page.getByTestId("elevation-profile-swatch")).toHaveCount(0);
    await board
      .locator('[data-layer="vegetation"] [data-elev-family="screen"]')
      .click();
    const swatch = page.getByTestId("elevation-profile-swatch");
    await expect(swatch).toBeVisible({ timeout: 5_000 });
    await expect(swatch.locator("[data-elev-family]").first()).toHaveAttribute(
      "data-elev-family",
      "screen",
    );
    await expect(page.getByTestId("elevation-plan-thumbnail")).toContainText(
      "Pleached hornbeam",
    );
    await expect(page.getByTestId("elevation-plan-thumbnail")).toContainText(
      "3.5 m h",
    );
  });

  test("fit sheet elevation strip mirrors the board silhouettes", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await seedElevationGarden(request, projectId);

    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });

    await page.getByTestId("fit-sheet-top").click();
    await expect(page.getByTestId("fit-sheet-layer")).toBeVisible({
      timeout: 10_000,
    });
    /*
     * The header segment sits under the top border chrome, which swallows a
     * real pointer click — dispatch straight at the control.
     */
    await page.getByTestId("sheet-elevations-toggle").dispatchEvent("click");

    const strip = page.getByTestId("fit-sheet-elevations");
    await expect(strip).toBeVisible({ timeout: 10_000 });
    // Two stacked looks x three standing assets — same families as the board.
    await expect(strip.locator('[data-elev-family="tree"]')).toHaveCount(2);
    await expect(strip.locator('[data-elev-family="screen"]')).toHaveCount(2);
    await expect(strip.locator('[data-elev-family="deck"]')).toHaveCount(2);
    await expect(strip.locator('[data-elev-family="plain"]')).toHaveCount(0);
    // Print sheet keeps the flat wash — no elevation texture defs here.
    await expect(strip.getByTestId("elevation-texture-defs")).toHaveCount(0);
  });
});
