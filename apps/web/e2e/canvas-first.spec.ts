import { expect, test } from "@playwright/test";
import { createAddressProject, pipelineShell } from "./helpers";

/**
 * Canvas-first progressive disclosure on the default WebGL mount: the mode
 * tabs carry the preserved 8-mode system, no cost chrome floats in sketch,
 * every mode mounts natively (glass cards / instruments), and Share stays
 * locked until a quote is persisted.
 */
test.describe("Canvas-first mode chrome", () => {
  test.setTimeout(process.env.CI ? 180_000 : 90_000);

  test("Mode tabs unlock progressively; CAD mounts natively", async ({
    page,
    request,
  }) => {
    // Use the deterministic survey seed instead of the asynchronous capture
    // pipeline. This test covers canvas chrome, not external capture timing.
    const { projectId } = await createAddressProject(request, {
      address: "E2E Canvas First, 12 Fit Sheet Ave, Melbourne VIC 3000",
      lat: -37.8136,
      lng: 144.9631,
      seedCanvas: true,
    });

    await page.goto(`/projects/${projectId}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
      timeout: 30_000,
    });
    await expect(pipelineShell(page)).toHaveCount(0);

    // The mode system is tabs on the default mount; sketch is native.
    await expect(page.getByTestId("studio-mode-tabs")).toBeVisible();
    await expect(page.getByTestId("mode-tab-sketch")).toBeVisible();
    // No Live BOM chrome floats over the sketch surface.
    await expect(page.getByTestId("live-bom-hud")).toHaveCount(0);

    // Progressive disclosure: Share is unavailable until a quote is persisted.
    await expect(page.getByTestId("mode-tab-share")).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    // CAD is native to the WebGL studio: technical plan (dims on) + the AI
    // drafter hub — no hand-off to the classic board.
    const cadTab = page.getByRole("button", { name: "Mode CAD" });
    await expect(cadTab).toBeVisible({ timeout: 60_000 });
    // The mode transition re-keys the chrome strip. A regular actionability
    // click can lose the button during that intentional detach on software
    // WebGL runners, so dispatch and wait for the authoritative mode marker.
    await cadTab.dispatchEvent("click");
    await expect(
      page.locator('[data-webgl-chrome][data-mode="cad"]'),
    ).toBeAttached({ timeout: 60_000 });
    await expect(page.getByTestId("studio-cad-card")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("cad-instruction")).toBeVisible();
    // Share stays locked until a quote is persisted (still asserted above via
    // the locked pill; unlocking it promotes through the share card).
  });
});
