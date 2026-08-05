import { expect, test } from "@playwright/test";
import { clickHeaderViewItem, handoffStudio } from "./helpers";

const API = process.env.API_URL ?? "http://localhost:3001";

const quoteBody = {
  quoteLines: [
    {
      id: "line-1",
      label: "Mass-planted Lomandra",
      unit: "m2",
      qty: 12,
      total: 1800,
    },
    {
      id: "line-2",
      label: "Bluestone paving",
      unit: "m2",
      qty: 8,
      total: 2400,
    },
  ],
  totalInclGst: 4620,
};

test.describe("Client share acceptance", () => {
  test("owner shares → client accepts → fit sheet shows Accepted", async ({
    page,
    request,
  }) => {
    const create = await request.post(`${API}/projects/`, {
      data: {
        address: "E2E Share Accept, 12 Test Lane, Melbourne VIC 3000",
        lat: -37.8136,
        lng: 144.9631,
      },
    });
    expect(create.ok()).toBeTruthy();
    const { project } = (await create.json()) as {
      project: { id: string };
    };
    const projectId = project.id;

    await request.post(`${API}/projects/${projectId}/survey`);

    const share = await request.post(
      `${API}/projects/${projectId}/share-revisions`,
      { data: quoteBody },
    );
    expect(share.status()).toBe(201);
    const shareBody = (await share.json()) as {
      revision: { token: string; revision: string };
      share_url: string;
    };
    expect(shareBody.revision.revision).toBe("A");

    await page.goto(`/share/${shareBody.revision.token}`);
    await expect(page.getByTestId("share-client-page")).toBeVisible({
      timeout: 20_000,
    });
    // Digital-twin step 1 — WebGL scrub / lighting / atmosphere (SVG fallback ok).
    const twin = page.getByTestId("share-client-twin");
    const planSvg = page.getByTestId("share-plan-svg");
    const twinCanvas = page.getByTestId("share-twin-canvas");
    await expect(twin.or(planSvg)).toBeVisible({ timeout: 15_000 });
    if (await twin.isVisible()) {
      await expect(twinCanvas).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId("share-twin-sun")).toBeVisible();
      await page.getByTestId("share-twin-lights").click();
      await expect(page.getByTestId("share-twin-lights")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      await page.getByTestId("share-twin-atm-sage").click();
      await expect(page.getByTestId("share-twin-atm-sage")).toHaveAttribute(
        "data-on",
        "1",
      );
    }
    await expect(page.getByTestId("share-total")).toContainText("$4,620");
    await expect(page.getByTestId("share-disclaimer")).toContainText(
      "Not a formal tender",
    );

    await page.getByTestId("share-accept").click();
    await page.getByTestId("share-client-name").fill("Alex Homeowner");
    await page.getByTestId("share-accept-confirm").click();
    await expect(page.getByTestId("share-decision-done")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("share-accept-followup")).toContainText(
      "Curtis & Co will be in touch",
    );

    const list = await request.get(
      `${API}/projects/${projectId}/share-revisions`,
    );
    expect(list.ok()).toBeTruthy();
    const revisions = (
      await list.json()
    ).revisions as Array<{ status: string; revision: string }>;
    expect(revisions[0]?.status).toBe("accepted");

    await page.goto(`/projects/${projectId}?mode=cad`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });

    // Fit sheet stamp — open fit sheet and assert Accepted.
    await clickHeaderViewItem(page, "fit-sheet-top");
    await expect(page.getByTestId("fit-sheet-share-stamp")).toHaveText(
      /Rev A · Accepted/,
      { timeout: 15_000 },
    );
  });
});
