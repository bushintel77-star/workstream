import { expect, test } from "@playwright/test";
import { randomUUID } from "crypto";
import { createAddressProject } from "./helpers";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/**
 * WebGL sketch → CAD + native selection — the two confirmed gaps closed.
 *
 * Tidy path: context-aware classifier → confidence-scored ghost review
 * (accept/reject) → live placement through the shared DesignCanvas contract.
 * Convert path: one-click ditch/path/wall/bed features, ink kept.
 * Selection: one state across placements/features/photo strokes, persisting
 * across mode switches; Esc clears.
 */

test.describe("WebGL sketch to CAD + selection", () => {
  test("tidy proposes and accepts into the persisted contract; convert persists features; selection survives mode switches", async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);
    const { projectId } = await createAddressProject(request, {
      address: "1 Sketch Cad Street, Melbourne VIC 3000",
    });

    // Seed board-% ink the classifiers recognise:
    //  - a tiny dot near the board centre → "feature tree" proposal (clickable
    //    at the canvas centre in the default plan rig)
    //  - a thin straight line near the default lot edge → hedge proposal
    const seed = await request.put(`${API}/projects/${projectId}/design-canvas`, {
      data: {
        placements: [],
        strokes: [
          {
            id: randomUUID(),
            points: [
              { x_pct: 50, y_pct: 50 },
              { x_pct: 50.5, y_pct: 50 },
              { x_pct: 50.5, y_pct: 50.5 },
            ],
            color: "#ff2ef6",
            width_px: 2.5,
          },
          {
            id: randomUUID(),
            points: [
              { x_pct: 12, y_pct: 80 },
              { x_pct: 12, y_pct: 60 },
              { x_pct: 12, y_pct: 40 },
            ],
            color: "#ff2ef6",
            width_px: 2.5,
          },
        ],
      },
    });
    expect(seed.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}?mode=sketch`, {
      waitUntil: "networkidle",
    });
    await expect(page.getByTestId("webgl-studio")).toBeVisible({
      timeout: 30_000,
    });

    // --- Tidy from the rail (the sketch→CAD primary action, not buried) ---
    await page.getByTestId("rail-tidy").click();
    const review = page.getByTestId("cad-review");
    await expect(review).toBeVisible({ timeout: 15_000 });
    const rows = page.getByTestId("cad-proposal-row");
    await expect(rows).toHaveCount(2);

    // Confidence-scored accept/reject pattern (SVG ghost-review parity):
    // accept the feature-tree proposal (confidence 80), reject the hedge.
    await rows.filter({ has: page.getByText("Feature tree") }).click();
    await expect(page.getByTestId("cad-proposal-chip")).toContainText("80%");
    await page.getByTestId("cad-accept").click();
    await expect(rows).toHaveCount(1);
    await page.getByTestId("cad-reject").click();
    await expect(page.getByTestId("cad-review")).toHaveCount(0);

    // --- Persisted contract: placement saved, ink kept (provenance) ---
    await expect(page.getByTestId("save-status-chip")).toHaveAttribute(
      "data-status",
      "saved",
      { timeout: 20_000 },
    );
    let canvasRes = await request.get(`${API}/projects/${projectId}/design-canvas`);
    expect(canvasRes.ok()).toBeTruthy();
    let canvasJson = (await canvasRes.json()) as {
      canvas: {
        placements: Array<{ symbol_id: string }>;
        strokes: unknown[];
        features: unknown[];
      };
    };
    expect(canvasJson.canvas.placements).toHaveLength(1);
    expect(canvasJson.canvas.placements[0]!.symbol_id).toBe("olive-standard");
    expect(canvasJson.canvas.strokes).toHaveLength(2); // source ink kept
    expect(canvasJson.canvas.features).toHaveLength(0); // no outline → no mirror

    // --- Selection: placement pick at the canvas centre (default plan rig) ---
    const canvas = page.getByTestId("webgl-canvas");
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByTestId("selection-chip")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("selection-count")).toContainText("1 selected");

    // Mode switches within WebGL never lose the selection (Part B gap).
    await page.getByTestId("mode-tab-cad").click();
    await expect(page.getByTestId("selection-count")).toContainText("1 selected");
    await page.getByTestId("mode-tab-sketch").click();
    await expect(page.getByTestId("selection-count")).toContainText("1 selected");

    // Esc clears.
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("selection-chip")).toHaveCount(0);

    // --- Reload: the accepted placement hydrates onto the WebGL mount ---
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByTestId("webgl-studio")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("strip-stats")).toContainText("I1", {
      timeout: 15_000,
    });

    // --- One-click convert: real features persist, ink stays ---
    await page.getByTestId("sketch-convert-cad").click();
    await expect(page.getByTestId("sketch-cad-notice")).toContainText(
      "Converted",
      { timeout: 10_000 },
    );
    await expect(page.getByTestId("save-status-chip")).toHaveAttribute(
      "data-status",
      "saved",
      { timeout: 20_000 },
    );
    canvasRes = await request.get(`${API}/projects/${projectId}/design-canvas`);
    canvasJson = (await canvasRes.json()) as typeof canvasJson;
    expect(canvasJson.canvas.features.length).toBeGreaterThan(0);
    expect(canvasJson.canvas.strokes).toHaveLength(2); // ink kept after convert

    // Feature pick (linework wins the nearest-pick precedence).
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByTestId("selection-count")).toContainText("1 selected");
  });
});
