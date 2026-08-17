import { test, expect, type ConsoleMessage } from "@playwright/test";
import { createAddressProject } from "./helpers";
import { randomUUID } from "node:crypto";

/**
 * Terrain instruments e2e — drainage flow + earthworks cut/fill.
 *
 * Seeds a project with real spot levels (a N/S + E/W slope — deliberately
 * asymmetric so the terrain relief is meaningful) and one closed, extruded
 * sketch stroke (a pad), then verifies the Vertical Truth instrument family:
 *
 *   1. The Section + Flow toggle chips appear (terrain-gated).
 *   2. Toggling Flow mounts the Drainage telemetry card.
 *   3. The Earthworks card is live by default (earthworksView defaults on
 *      and a pad exists) with real cut/fill readouts.
 *   4. No fatal console errors while the instruments compute.
 */

/** Sloped lot: ~1.2 m fall to the south + 0.2 m fall to the east. */
const SLOPED_LEVELS = [
  { x_pct: 25, y_pct: 25, z_m: 50.0, source: "authored" as const },
  { x_pct: 75, y_pct: 25, z_m: 49.8, source: "authored" as const },
  { x_pct: 25, y_pct: 75, z_m: 51.2, source: "authored" as const },
  { x_pct: 75, y_pct: 75, z_m: 51.0, source: "authored" as const },
];

/** One closed square pad (40..60 % board) extruded to 1.2 m (render units). */
const PAD_STROKE = {
  id: randomUUID(),
  points: [
    { x_pct: 40, y_pct: 40 },
    { x_pct: 60, y_pct: 40 },
    { x_pct: 60, y_pct: 60 },
    { x_pct: 40, y_pct: 60 },
    { x_pct: 40, y_pct: 40 },
  ],
  color: "#ff2ef6",
  width_px: 2.5,
  kind: "ink" as const,
  extrude_height_m: 1.2,
};

test.describe("WebGL terrain instruments (drainage + earthworks)", () => {
  test("flow toggle + earthworks card respond to seeded terrain and pad", async ({
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
      address: "1 Terrain Instruments Street, Melbourne VIC 3000",
    });

    // Seed terrain + pad via the canvas PUT (same channel as the studio autosave).
    const seed = await request.put(
      `http://127.0.0.1:3001/projects/${projectId}/design-canvas`,
      {
        data: {
          placements: [],
          strokes: [PAD_STROKE],
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
            levels: SLOPED_LEVELS,
          },
        },
      },
    );
    expect(seed.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}?webgl=1`, {
      waitUntil: "networkidle",
    });
    // Dynamic import + R3F Canvas mount.
    await page.waitForTimeout(4000);

    await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
      timeout: 10_000,
    });

    // Terrain-gated chips: Section + Flow render; Earth renders (pad exists).
    const flowChip = page.getByRole("button", { name: "▸ Flow" });
    await expect(flowChip).toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByRole("button", { name: "▸ Section" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "▾ Earth" })).toBeVisible();

    // Earthworks instrument renders as a collapsed chip (InstrumentCard's
    // "metadata at the border, detail on demand" idiom) — expand it.
    // Fresh chrome: terrain readouts live in the Terrain surface tab.
    await page.getByTestId("meta-tab-terrain").click();
    await expect(
      page.getByRole("button", { name: "Expand Earth" }),
    ).toBeVisible({ timeout: 5_000 });
    await page.getByRole("button", { name: "Expand Earth" }).click();
    const earthworks = page.locator('[data-testid="earthworks-card"]');
    await expect(earthworks).toBeVisible({ timeout: 5_000 });
    // The seeded pad contributes a cut/fill row with real volume figures.
    await expect(earthworks).toContainText("Cut / Fill total");
    await expect(earthworks).toContainText("Pad 1");

    // Toggle Flow → the drainage telemetry card mounts (as a collapsed
    // chip — expand it for the readouts).
    await flowChip.click();
    await page.getByRole("button", { name: "Expand Flow" }).click();
    const drainage = page.locator('[data-testid="drainage-flow-card"]');
    await expect(drainage).toBeVisible({ timeout: 5_000 });
    await expect(drainage).toContainText("Stream paths");
    await expect(drainage).toContainText("Ponding points");
    // The chip flips to its active label.
    await expect(
      page.getByRole("button", { name: "▾ Flow" }),
    ).toBeVisible();

    // No React render loops or fatal errors while the instruments compute.
    const fatal = errors.filter(
      (e) =>
        e.includes("Maximum update depth") ||
        e.includes("TypeError") ||
        e.includes("ReferenceError"),
    );
    expect(fatal, `Fatal console errors:\n${fatal.join("\n")}`).toHaveLength(0);
  });
});
