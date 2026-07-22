import { expect, test } from "@playwright/test";
import { handoffStudio } from "./helpers";

const API = process.env.API_URL ?? "http://localhost:3001";

/**
 * Phase 0 cream/zoom gate — parchment stays outside the camera;
 * aerial slot is transparent on free plan (hidePaper).
 */
test.describe("Canvas cream + zoom (Phase 0)", () => {
  test("free-plan parchment does not ride zoomWorld scale", async ({
    page,
    request,
  }) => {
    const create = await request.post(`${API}/projects/`, {
      data: {
        address: "E2E Cream Zoom, 22 Gate Lane, Melbourne VIC 3000",
        lat: -37.8136,
        lng: 144.9631,
      },
    });
    expect(create.ok()).toBeTruthy();
    const body = (await create.json()) as { project: { id: string } };
    const projectId = body.project.id;

    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });

    const aerial = page.getByTestId("aerial-image-slot");
    await expect(aerial).toBeVisible({ timeout: 15_000 });
    await expect(aerial).toHaveAttribute("data-hide-paper", "1");

    const aerialBg = await aerial.evaluate((el) =>
      getComputedStyle(el).backgroundColor,
    );
    // Transparent (or fully clear) — not cream parchment fill.
    expect(aerialBg).toMatch(/rgba?\(\s*0,\s*0,\s*0,\s*0\s*\)|transparent/i);

    const parchment = page.getByTestId("parchment-bleed");
    await expect(parchment).toBeVisible();
    const before = await parchment.boundingBox();
    expect(before).toBeTruthy();

    const board = page.getByTestId("studio-board");
    const box = await board.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.wheel(0, 800);
    await page.mouse.wheel(0, 800);

    const zoomWorld = page.getByTestId("zoom-world");
    const transform = await zoomWorld.evaluate(
      (el) => getComputedStyle(el).transform,
    );
    // matrix(a, b, c, d, e, f) — scale factor a should be well below 1 after zoom-out.
    const scaleMatch = /matrix\(([^,]+)/.exec(transform);
    expect(scaleMatch).toBeTruthy();
    const scaleA = Number(scaleMatch![1]);
    expect(scaleA).toBeLessThan(0.95);

    const after = await parchment.boundingBox();
    expect(after).toBeTruthy();
    expect(Math.abs(after!.width - before!.width)).toBeLessThan(2);
    expect(Math.abs(after!.height - before!.height)).toBeLessThan(2);
  });
});
