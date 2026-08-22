import { expect, test, type Page } from "@playwright/test";
import { createAddressProject } from "./helpers";

/** Prefer 127.0.0.1 — `localhost` can resolve to ::1 while the API binds IPv4. */
const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/**
 * Camera state on mode entry — the invariant no gate covered.
 *
 * `studioStore` initialised `liveRig: DEFAULT_CAMERA_RIG` whose `tiltDeg` was
 * 55, and `FusedCamera` derives its spring target from the LIVE pitch
 * (`blendTargetForPitch(rig.tiltDeg)`), ignoring `viewBlendTarget`. So the
 * camera sprang to full 55-degree perspective on every first mount in every
 * mode — `?mode=cad`, whose entire purpose is a locked plan view, opened
 * oblique. `onNativeMode` only set a pitch for cad and garden and only fires on
 * a tab click, shortcut or palette command, so no deep link ever reached it.
 *
 * The second-order defect from the same divergence: `StudioScene` computed
 * `tiltLocked` from `viewBlendTarget`, which stayed 0, so the operator saw a 3D
 * perspective while the studio believed it was in plan and left editing
 * unlocked. Asserting the blend AND the pitch witnesses covers both halves.
 *
 * Witnesses: the chrome overlay stamps `data-view-blend` (the committed
 * plan/3D target) and `data-pitch-deg` (the quantised LIVE rig pitch). Reading
 * both is the point — the bug was not a wrong angle, it was the two fields
 * disagreeing at rest, and only checking one of them would still pass.
 *
 * Before this, the camera state was readable only from the Plan/3D control
 * inside the summoned Studio meta panel and the projection HUD's presets, so
 * there was nothing a spec could assert in a mode where neither was mounted.
 */

async function openMode(page: Page, projectId: string, mode: string) {
  await page.goto(`/projects/${projectId}?webgl=1&mode=${mode}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
    timeout: 30_000,
  });
  // Let the camera spring settle — the assertions are about the state at rest.
  await page.waitForTimeout(4000);
}

function chrome(page: Page) {
  return page.locator("[data-webgl-chrome]");
}

test.describe("WebGL camera state on mode entry", () => {
  test("plan modes open in plan and 3D modes keep their pitch", async ({
    page,
    request,
  }) => {
    test.setTimeout(300_000);
    const { projectId } = await createAddressProject(request, {
      address: "9 Camera Entry Street, Melbourne VIC 3000",
    });
    const seed = await request.put(
      `${API}/projects/${projectId}/design-canvas`,
      {
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
              { x_pct: 65, y_pct: 25 },
              { x_pct: 65, y_pct: 45 },
              { x_pct: 35, y_pct: 45 },
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

    // 1600x950 — the operator's viewport, and wide enough that the projection
    // HUD renders its full capsule with the pitch presets.
    await page.setViewportSize({ width: 1600, height: 950 });

    // --- The plan modes: blend committed to plan AND pitch flat ---
    for (const mode of ["survey", "sketch", "cad"] as const) {
      await openMode(page, projectId, mode);
      await expect
        .soft(chrome(page), `?mode=${mode} entered the wrong mode`)
        .toHaveAttribute("data-mode", mode);
      await expect
        .soft(chrome(page), `?mode=${mode} must commit the plan blend`)
        .toHaveAttribute("data-view-blend", "plan");
      await expect
        .soft(
          chrome(page),
          `?mode=${mode} must open at a flat pitch — 55 was the old rig default`,
        )
        .toHaveAttribute("data-pitch-deg", "0");
    }

    // --- Garden: eye-level pitch, 3D blend ---
    await openMode(page, projectId, "garden");
    await expect
      .soft(chrome(page), "?mode=garden must commit the 3D blend")
      .toHaveAttribute("data-view-blend", "3d");
    await expect
      .soft(
        chrome(page),
        "?mode=garden must land on the garden eye level, not the oblique orbit",
      )
      .toHaveAttribute("data-pitch-deg", "75"); // 76 quantised to 5-deg steps

    // --- Elevation: horizon pitch, 3D blend ---
    await openMode(page, projectId, "elevation");
    await expect
      .soft(chrome(page), "?mode=elevation must commit the 3D blend")
      .toHaveAttribute("data-view-blend", "3d");
    await expect
      .soft(chrome(page), "?mode=elevation must land on the horizon")
      .toHaveAttribute("data-pitch-deg", "90");
  });
});
