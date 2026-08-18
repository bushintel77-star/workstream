import { expect, test } from "@playwright/test";
import { createAddressProject } from "./helpers";

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLxVQAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("WebGL photo-trace elevation (sketch capstone)", () => {
  test("pins a photo, traces on the plane, calibrates by reference line, and prints a stamped sheet", async ({
    page,
    request,
  }) => {
    test.setTimeout(240_000);
    const { projectId } = await createAddressProject(request, {
      address: "1 Photo Trace Elevation Street, Melbourne VIC 3000",
    });
    await page.goto(`/projects/${projectId}?mode=sketch`, {
      waitUntil: "networkidle",
    });
    await expect(page.getByTestId("webgl-studio")).toBeVisible({
      timeout: 30_000,
    });

    // Upload a site photo to the gallery.
    await page.getByTestId("meta-tab-studio").click();
    await expect(page.getByTestId("site-photo-gallery")).toBeVisible();
    const uploadResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/projects/${projectId}/site-photos`) &&
        response.request().method() === "POST",
    );
    await page.getByTestId("site-photo-upload").click();
    await page.getByLabel("Choose a site photo").setInputFiles({
      name: "rear-fence.png",
      mimeType: "image/png",
      buffer: PNG_1PX,
    });
    expect((await uploadResponse).ok()).toBe(true);
    await expect(page.getByTestId("site-photo-row")).toBeVisible({
      timeout: 15_000,
    });

    // Pin the photo — the camera flies to the frozen facade frame and the
    // trace HUD appears with honest stamps: uncalibrated, and (this seed has
    // no title boundary yet) locational-indicative.
    await page.getByTestId("site-photo-pin").click();
    const hud = page.getByTestId("photo-trace-hud");
    await expect(hud).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("photo-trace-stamp")).toContainText(
      "Uncalibrated",
    );
    await expect(page.getByTestId("photo-trace-boundary-stamp")).toContainText(
      "position indicative",
    );
    // Let the 0.7s camera fly settle before pointer work.
    await page.waitForTimeout(1500);

    // Freehand trace on the plane — the pointer lands on the photo, not the
    // ground, and the stroke persists through autosave. The facade ortho
    // maps the plane (standing on the ground line at the 50% screen line)
    // to the UPPER half of the screen — drag upward from the ground line.
    const canvas = page.getByTestId("webgl-canvas");
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (!box) throw new Error("WebGL canvas has no bounding box");
    await page.mouse.move(box.x + box.width * 0.42, box.y + box.height * 0.44);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width * 0.58,
      box.y + box.height * 0.38,
      { steps: 3 },
    );
    await page.mouse.up();
    await expect(page.getByTestId("save-status-chip")).toHaveAttribute(
      "data-status",
      "saved",
      { timeout: 20_000 },
    );

    // Reference-line calibration — draw along a known length and apply the
    // 1.8 m fence preset. The stamp must flip from indicative to calibrated.
    await page.getByTestId("photo-trace-calibrate").click();
    await expect(page.getByTestId("photo-calibrate-apply")).toBeVisible();
    const presets = page.getByTestId("photo-calibrate-preset");
    await expect(presets.first()).toBeVisible();
    await presets.first().click();
    await expect(presets.first()).toHaveAttribute("aria-pressed", "true");

    await page.mouse.move(box.x + box.width * 0.36, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width * 0.64,
      box.y + box.height * 0.5,
      { steps: 3 },
    );
    await page.mouse.up();
    await expect(page.getByTestId("photo-calibrate-draft-length")).toContainText(
      "Reference line:",
    );
    await page.getByTestId("photo-calibrate-apply").click();

    await expect(page.getByTestId("photo-trace-stamp")).toContainText(
      "Calibrated against 1.8 m fence line",
      { timeout: 10_000 },
    );

    // Exit the pin — the plane unmounts, the paper canvas is clean again.
    await page.getByTestId("photo-trace-exit").click();
    await expect(hud).toHaveCount(0);

    // The elevation sheet is the terminal artifact: photo at true-metre
    // scale, the trace overlaid, and the calibration stamp.
    await page.getByTestId("meta-tab-studio").click();
    await expect(page.getByTestId("site-photo-row")).toBeVisible();
    await expect(page.getByTestId("site-photo-stamp")).toContainText(
      "Calibrated against 1.8 m fence line",
    );
    await page.getByTestId("site-photo-sheet").click();
    const sheet = page.getByTestId("photo-elevation-sheet");
    await expect(sheet).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("photo-sheet-stamp")).toContainText(
      "Calibrated against 1.8 m fence line",
    );
    // Boundary honesty — no title boundary in this seed, so the sheet must
    // say the position is locational-indicative rather than stay silent.
    await expect(page.getByTestId("photo-sheet-boundary-stamp")).toContainText(
      "Position not verified against the title boundary — locational-indicative",
    );
    await expect(sheet).toContainText("1 trace strokes");

    // Persistence honesty — a reload must bring the calibrated sheet back
    // with its strokes intact (autosave wrote photo_elevations).
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByTestId("webgl-studio")).toBeVisible({
      timeout: 30_000,
    });
    await page.getByTestId("meta-tab-studio").click();
    await expect(page.getByTestId("site-photo-row")).toBeVisible();
    await expect(page.getByTestId("site-photo-stamp")).toContainText(
      "Calibrated against 1.8 m fence line",
    );
    await page.getByTestId("site-photo-sheet").click();
    await expect(page.getByTestId("photo-elevation-sheet")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("photo-elevation-sheet")).toContainText(
      "1 trace strokes",
    );
  });
});
