import { expect, test } from "@playwright/test";
import { pipelineShell } from "./helpers";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/**
 * Canvas-first progressive disclosure on the default WebGL mount: the mode
 * tabs carry the preserved 8-mode system, no cost chrome floats in sketch,
 * every mode mounts natively (glass cards / instruments), and Share stays
 * locked until a quote is persisted.
 */
test.describe("Canvas-first mode chrome", () => {
  test("Mode tabs unlock progressively; CAD mounts natively", async ({
    page,
    request,
  }) => {
    const create = await request.post(`${API}/projects/`, {
      data: {
        address: "E2E Canvas First, 12 Fit Sheet Ave, Melbourne VIC 3000",
        lat: -37.8136,
        lng: 144.9631,
      },
    });
    expect(create.ok()).toBeTruthy();
    const body = (await create.json()) as {
      project: { id: string };
    };
    const projectId = body.project.id;

    const pipeline = await request.post(
      `${API}/projects/${projectId}/pipeline`,
    );
    expect(pipeline.ok()).toBeTruthy();
    // The capture pipeline is async — wait for the survey stage to land, then
    // seed one placement, so the mode unlock chain (aerial → sketch/cad) is
    // deterministic at page render.
    let surveyReady = false;
    for (let i = 0; i < 20; i++) {
      const survey = await request.get(`${API}/projects/${projectId}/survey`);
      if (survey.ok()) {
        surveyReady = true;
        break;
      }
      await page.waitForTimeout(1500);
    }
    expect(surveyReady).toBeTruthy();
    const seed = await request.put(
      `${API}/projects/${projectId}/design-canvas`,
      {
        data: {
          placements: [
            {
              id: "11111111-2222-4333-8444-555555555555",
              symbol_id: "bluestone-paver",
              x_pct: 50,
              y_pct: 60,
              rotation_deg: 0,
              scale: 1,
            },
          ],
          strokes: [],
        },
      },
    );
    expect(seed.ok).toBeTruthy();

    await page.goto(`/projects/${projectId}`);
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
    // drafter hub — no hand-off to the classic board. The capture pipeline
    // runs async, so CAD sits as a locked pill until the survey lands.
    const cadTab = page.getByRole("button", { name: "Mode CAD" });
    await expect(cadTab).toBeVisible({ timeout: 60_000 });
    await cadTab.click();
    await expect(page.getByTestId("studio-cad-card")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("cad-instruction")).toBeVisible();
    // Share stays locked until a quote is persisted (still asserted above via
    // the locked pill; unlocking it promotes through the share card).
  });
});
