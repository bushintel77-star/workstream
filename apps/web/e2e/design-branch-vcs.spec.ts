import { expect, test } from "@playwright/test";
import {
  createSurveyProject,
  handoffStudio,
  openCommandPalette,
} from "./helpers";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/**
 * Async design VCS: branch from main → edit tip → diff → merge → main tip equals merge.
 * Also covers abandon + ops schedules dock.
 */
test.describe("Design branch VCS", () => {
  test("branch, checkout, merge, schedules pack", async ({ page, request }) => {
    const { projectId } = await createSurveyProject(request);

    const placeId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const seed = await request.put(
      `${API}/projects/${projectId}/design-canvas`,
      {
        data: {
          placements: [
            {
              id: placeId,
              symbol_id: "hornbeam-pleached",
              x_pct: 25,
              y_pct: 35,
              rotation_deg: 0,
              scale: 1,
            },
          ],
          construction_trenches: [],
        },
      },
    );
    expect(seed.ok()).toBeTruthy();

    const fork = await request.post(
      `${API}/projects/${projectId}/design-branches`,
      { data: { name: "Option — heavy planting" } },
    );
    expect(fork.ok()).toBeTruthy();
    const branchId = ((await fork.json()) as { branch: { id: string } }).branch
      .id;

    const trenchId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const featureSave = await request.put(
      `${API}/projects/${projectId}/design-canvas`,
      {
        data: {
          branch_id: branchId,
          placements: [
            {
              id: placeId,
              symbol_id: "hornbeam-pleached",
              x_pct: 25,
              y_pct: 35,
              rotation_deg: 0,
              scale: 1,
            },
            {
              id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              symbol_id: "lomandra-mass",
              x_pct: 55,
              y_pct: 55,
              rotation_deg: 0,
              scale: 1,
            },
          ],
          construction_trenches: [
            {
              id: trenchId,
              name: "Irrig main",
              kind: "irrig_main",
              points: [
                { x_pct: 15, y_pct: 20 },
                { x_pct: 70, y_pct: 20 },
              ],
              depth_mm: 400,
              source: "auto",
            },
          ],
        },
      },
    );
    expect(featureSave.ok()).toBeTruthy();

    const diff = await request.get(
      `${API}/projects/${projectId}/design-branches/${branchId}/diff`,
    );
    expect(diff.ok()).toBeTruthy();
    const diffBody = (await diff.json()) as {
      diff: { added: number };
    };
    expect(diffBody.diff.added).toBeGreaterThan(0);

    const merge = await request.post(
      `${API}/projects/${projectId}/design-branches/${branchId}/merge`,
      { data: {} },
    );
    expect(merge.ok()).toBeTruthy();

    const mainTip = await request.get(
      `${API}/projects/${projectId}/design-canvas`,
    );
    const canvas = ((await mainTip.json()) as {
      canvas: {
        placements: unknown[];
        construction_trenches: unknown[];
      };
    }).canvas;
    expect(canvas.placements).toHaveLength(2);
    expect(canvas.construction_trenches).toHaveLength(1);

    const scratch = await request.post(
      `${API}/projects/${projectId}/design-branches`,
      { data: { name: "Scratch abandon" } },
    );
    const scratchId = ((await scratch.json()) as { branch: { id: string } })
      .branch.id;
    const abandon = await request.post(
      `${API}/projects/${projectId}/design-branches/${scratchId}/abandon`,
    );
    expect(abandon.ok()).toBeTruthy();

    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });

    await openCommandPalette(page);
    await page.getByLabel("Search assets").fill("design branches");
    await page.getByTestId("canvas-command-design-branches").click();
    await expect(page.getByTestId("design-branch-dock")).toBeVisible();
    await expect(page.getByTestId("design-branch-tree")).toBeVisible();
    await expect(
      page.getByTestId("design-branch-tree").getByTestId("design-branch-thumbnail"),
    ).toHaveCount(3);

    await openCommandPalette(page);
    await page.getByLabel("Search assets").fill("ops schedules");
    await page.getByTestId("canvas-command-ops-schedules").click();
    await expect(page.getByTestId("ops-schedules-dock")).toBeVisible();
    await expect(page.getByTestId("ops-schedule-tab-planting")).toBeVisible();
    await page.getByTestId("ops-schedule-tab-trench").click();
    await page.getByTestId("ops-schedule-issue-pack").click();
  });
});
