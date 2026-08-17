import { expect, test } from "@playwright/test";
import { createAddressProject } from "./helpers";

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLxVQAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("WebGL photo to hand-sketch flow", () => {
  test("uploads a site image, separates layers, and saves pen input", async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);
    const { projectId } = await createAddressProject(request, {
      address: "1 Photo Sketch Flow Street, Melbourne VIC 3000",
    });
    await page.goto(`/projects/${projectId}?mode=sketch`, {
      waitUntil: "networkidle",
    });
    await expect(page.getByTestId("webgl-studio")).toBeVisible({
      timeout: 30_000,
    });

    // Fresh chrome: the photo action lives in the Studio surface tab.
    await page.getByTestId("meta-tab-studio").click();
    const uploadResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/projects/${projectId}/aerial`) &&
        response.request().method() === "POST",
    );
    await page
      .getByLabel("Choose a site photo to trace")
      .setInputFiles({
        name: "site-reference.png",
        mimeType: "image/png",
        buffer: PNG_1PX,
      });
    expect((await uploadResponse).ok()).toBe(true);
    await expect(page.getByTestId("webgl-studio")).toBeVisible({
      timeout: 30_000,
    });

    // Layers are a surface tab in the fresh chrome.
    await page.getByTestId("meta-tab-layers").click();
    const controls = page.getByRole("group", { name: "Canvas layers" });
    const photoLayer = controls.getByRole("button", { name: "Photo" });
    const inkLayer = controls.getByRole("button", { name: "Ink" });
    const truthLayer = controls.getByRole("button", { name: "Site truth" });
    const designLayer = controls.getByRole("button", { name: "Design" });
    await expect(photoLayer).toHaveAttribute("aria-pressed", "true");
    await expect(inkLayer).toHaveAttribute("aria-pressed", "true");
    await expect(truthLayer).toHaveAttribute("aria-pressed", "true");
    await expect(designLayer).toHaveAttribute("aria-pressed", "true");
    await photoLayer.click();
    await expect(photoLayer).toHaveAttribute("aria-pressed", "false");
    await photoLayer.click();

    await page.getByTestId("rail-sketch").click();
    const canvas = page.getByTestId("webgl-canvas");
    await expect(canvas).toBeVisible({ timeout: 30_000 });
    const box = await canvas.boundingBox();
    if (!box) throw new Error("WebGL canvas has no bounding box");
    await page.mouse.move(box.x + box.width * 0.42, box.y + box.height * 0.45);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width * 0.58,
      box.y + box.height * 0.58,
      { steps: 3 },
    );
    await page.mouse.up();

    await expect(page.getByTestId("save-status-chip")).toHaveAttribute(
      "data-status",
      "saved",
      { timeout: 20_000 },
    );
  });
});
