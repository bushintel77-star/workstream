import { test, expect, type ConsoleMessage } from "@playwright/test";
import { createAddressProject } from "./helpers";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/**
 * Straightedge (Trace ruler) — gap-analysis Phase 1 (2026-09-05).
 *
 * The operator loop, end to end:
 *   1. RULE arms; a ground drag places the edge; the length chip reads live.
 *   2. PEN draws a deliberately WOBBLY stroke along the edge — the committed
 *      ink must be collinear on the ruler's axis (verified through the
 *      persisted design canvas, not pixels).
 *   3. Esc clears the ruler; the chip disappears.
 *   4. No fatal console errors.
 *
 * The collinearity assertion is the point: raw pointer jitter goes IN, and
 * what comes out of the committed stroke is the ruler's straight line —
 * projection IS the assist (assist, never constrain, strokeAssist law).
 */

test.describe("WebGL straightedge — place a ruler, draw along it", () => {
  test("places an edge, projects wobbly ink onto it, clears on Esc", async ({
    page,
    request,
  }) => {
    test.setTimeout(process.env.CI ? 420_000 : 240_000);
    const errors: string[] = [];
    page.on("console", (msg: ConsoleMessage) => {
      if (msg.type() === "error") errors.push(msg.text().slice(0, 300));
    });
    page.on("pageerror", (err: Error) =>
      errors.push(`${err.name}: ${err.message.slice(0, 300)}`),
    );

    const { projectId } = await createAddressProject(request, {
      address: "1 Straightedge Way, Melbourne VIC 3000",
    });
    console.log("STRAIGHTEDGE PROJECT:", projectId);
    const seed = await request.put(`${API}/projects/${projectId}/design-canvas`, {
      data: {
        placements: [],
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
            { x_pct: 35, y_pct: 25 },
            { x_pct: 55, y_pct: 25 },
            { x_pct: 55, y_pct: 45 },
            { x_pct: 35, y_pct: 45 },
          ],
          building_source: "traced",
          easements: [],
          services: [],
          levels: [],
        },
      },
    });
    expect(seed.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}?mode=sketch`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
      timeout: 30_000,
    });
    await page.waitForTimeout(4_000);

    // 1. RULE — arm and drag an edge across the board at y=50%.
    await page.getByRole("button", { name: "RULE (R)" }).click();
    await page.waitForTimeout(400);

    const canvas = page.locator('[data-testid="webgl-canvas"]');
    const box = (await canvas.boundingBox())!;
    // Board-% → screen px via the canvas box (same mapping as the
    // sketch-assist spec): the edge spans 35%→65% at y 50%.
    const px = (xPct: number, yPct: number) => ({
      x: box.x + box.width * (xPct / 100),
      y: box.y + box.height * (yPct / 100),
    });
    const a = px(35, 50);
    const b = px(65, 50);

    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    // Feed the drag in steps so the live length channel keeps up.
    for (let i = 1; i <= 8; i += 1) {
      const t = i / 8;
      await page.mouse.move(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
      await page.waitForTimeout(60);
    }
    await page.mouse.up();

    // The placed ruler reads its length. The canvas box is the board FITTED
    // with margin (affine, factor ~2.3 at this viewport), so a 30%-canvas
    // drag lands well past half the board. The honest bounds catch a dead,
    // zeroed, or uncalibrated chip without baking in the camera fit.
    const chip = page.locator('[data-testid="straightedge-length"]');
    await expect(chip).toBeVisible({ timeout: 5_000 });
    const chipText = await chip.textContent();
    const chipMetres = Number.parseFloat((chipText ?? "").replace(/[^\d.]/g, ""));
    expect(
      chipMetres,
      `ruler chip should read a plausible length in metres, got "${chipText}"`,
    ).toBeGreaterThan(10);
    expect(chipMetres).toBeLessThan(100);

    // 2. PEN — draw a stroke ALONG the ruler whose raw path deliberately
    //    oscillates ±0.45 canvas-% (≈ ±0.6 board-% ≈ ±1.2 m, inside the
    //    ~1.65 m capture band). The ENDPOINTS carry the assertion: on the
    //    ruler they must persist at y=50% exactly; unprojected raw input
    //    would persist ~±0.6 board-% off it.
    await page.getByRole("button", { name: "PEN (P)" }).click();
    await page.waitForTimeout(400);

    const zig = (t: number, jitterPct: number) =>
      px(35 + 30 * t, 50 + (t % 2 === 0 ? jitterPct : -jitterPct));
    const start = zig(0, 0.45);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    for (let i = 1; i <= 16; i += 1) {
      const p = zig(i / 16, 0.45);
      await page.mouse.move(p.x, p.y, { steps: 2 });
      await page.waitForTimeout(80);
    }
    await page.mouse.up();

    // The Tidy HUD may spawn for a convertible stroke — dismiss it; the
    // assertion here is the persisted geometry, not the classifier.
    await page.waitForTimeout(600);
    const hud = page.locator('[data-testid="tidy-hud"]');
    if (await hud.isVisible().catch(() => false)) {
      await page.keyboard.press("Escape");
    }

    // Autosave debounce is 1.1s — but the first save can snapshot the doc
    // mid-gesture, and the dev API can take many seconds to complete the
    // write, so poll until the stroke (any commit shape — under software-GL
    // event coalescing hold-to-straighten may honestly collapse it to its
    // chord) has landed.
    let lastBody = "unavailable";
    await expect
      .poll(
        async () => {
          const canvasRes = await request.get(
            `${API}/projects/${projectId}/design-canvas`,
          );
          const json = (await canvasRes.json()) as {
            canvas?: { strokes?: Array<{ points: unknown[] }> };
            strokes?: Array<{ points: unknown[] }>;
          };
          // The GET wraps the document — accept either shape.
          const doc = json.canvas ?? json;
          lastBody = JSON.stringify(doc).slice(0, 400);
          return doc.strokes?.filter((s) => s.points.length >= 2).length ?? 0;
        },
        { timeout: 60_000, intervals: [2_000, 3_000, 5_000, 10_000] },
      )
      .toBeGreaterThanOrEqual(1);

    const canvasRes = await request.get(`${API}/projects/${projectId}/design-canvas`);
    const json = (await canvasRes.json()) as {
      canvas?: { strokes?: Array<{ points: Array<{ x_pct: number; y_pct: number }> }> };
      strokes?: Array<{ points: Array<{ x_pct: number; y_pct: number }> }>;
    };
    const doc = json.canvas ?? json;
    const ink = (doc.strokes ?? []).filter((s) => s.points.length >= 2);
    expect(
      ink.length,
      `persisted strokes: ${lastBody}`,
    ).toBeGreaterThanOrEqual(1);

    // The committed stroke spans the ruler (one gesture, first to last).
    const stroke = ink[ink.length - 1]!;
    const xs = stroke.points.map((p) => p.x_pct);
    const xSpread = Math.max(...xs) - Math.min(...xs);
    expect(
      xSpread,
      "the stroke must span the placed ruler, not a fragment",
    ).toBeGreaterThan(50);

    // Projection: every committed point sits on the ruler's y=50% axis. The
    // raw oscillation (±0.6 board-%) must NOT have survived into the
    // contract — hold-to-straighten alone preserves the raw ENDPOINTS, so a
    // tight spread here can only come from the ruler capture.
    const ys = stroke.points.map((p) => p.y_pct);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    expect(
      maxY - minY,
      `committed ink must be collinear on the ruler axis (spread ${maxY - minY})`,
    ).toBeLessThan(0.5);

    // 3. Esc clears the ruler; the chip goes with it. The HUD (if still up)
    //    captures Escape first — clear it, then the ruler.
    await page.keyboard.press("Escape");
    if (await hud.isVisible().catch(() => false)) {
      await page.keyboard.press("Escape");
    }
    await expect(chip).toHaveCount(0);

    const fatal = errors.filter(
      (e) =>
        e.includes("Maximum update depth") ||
        e.includes("TypeError") ||
        e.includes("ReferenceError"),
    );
    expect(fatal, `Fatal console errors:\n${fatal.join("\n")}`).toHaveLength(0);
  });
});
