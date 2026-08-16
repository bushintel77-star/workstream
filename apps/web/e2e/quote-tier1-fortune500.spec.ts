import { expect, test, type Page } from "@playwright/test";
import {
  clickHeaderViewItem,
  createCarltonControlProject,
  createWrightsTier1Project,
  handoffStudio,
  TIER1_WRIGHTS_ADDRESS,
} from "./helpers";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/**
 * Opens the Live Cost Rail alongside the CAD drawing, then expands it to the
 * full QuoteBuilder so the Tier-1 ledger and target are rendered.
 */
async function openQuoteBuilder(page: Page, projectId: string) {
  await page.goto(`/projects/${projectId}?svg=1&mode=cad`);
  await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
  await clickHeaderViewItem(page, "live-cost-top");
  await expect(page.getByTestId("live-cost-rail")).toBeVisible({
    timeout: 15_000,
  });
  await page.getByTestId("live-cost-rail-expand").click();
  await expect(page.getByTestId("quote-surface")).toBeVisible({
    timeout: 15_000,
  });
}

/**
 * Fortune-500 Tier-1 kept smokes — Quote ledger, portal payload, share honesty.
 */
test.describe("Fortune-500 Tier-1 Quote + portal", () => {
  test("Wrights Quote ledger + share total honesty", async ({
    page,
    request,
  }) => {
    const { projectId } = await createWrightsTier1Project(request);

    await openQuoteBuilder(page, projectId);
    await expect(page.getByTestId("tier1-quote-ledger")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("tier1-quote-target")).toContainText(
      /Target quote \$58,410/,
    );

    // Operator-authored share must keep the posted total (no silent rewrite).
    const share = await request.post(
      `${API}/projects/${projectId}/share-revisions`,
      {
        data: {
          quoteLines: [
            {
              id: "line-1",
              label: "Tier-1 standard package",
              unit: "allowance",
              qty: 1,
              total: 58410.35,
            },
          ],
          totalInclGst: 58410.35,
        },
      },
    );
    expect(share.status()).toBe(201);
    const shareBody = (await share.json()) as {
      revision: { token: string };
    };

    await page.goto(`/share/${shareBody.revision.token}`);
    await expect(page.getByTestId("share-client-page")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("share-total")).toContainText("$58,410");
    await expect(page.getByTestId("share-disclaimer")).toContainText(
      "Not a formal tender",
    );
  });

  test("Carlton control never shows Tier-1 ledger on Quote", async ({
    page,
    request,
  }) => {
    const { projectId } = await createCarltonControlProject(request);
    await openQuoteBuilder(page, projectId);
    await expect(page.getByTestId("tier1-quote-ledger")).toHaveCount(0);
  });

  test("portal magic-link JSON: Wrights tier1 payload, Carlton null", async ({
    request,
  }) => {
    const { projectId: wrightsId } = await createWrightsTier1Project(request, {
      seedCanvas: false,
    });
    // Portal tier1 keys off project address + costing — run design/cost path.
    expect(
      (await request.post(`${API}/projects/${wrightsId}/design`)).ok(),
    ).toBeTruthy();
    expect(
      (await request.post(`${API}/projects/${wrightsId}/costing`)).ok(),
    ).toBeTruthy();

    const wLink = await request.post(
      `${API}/projects/${wrightsId}/magic-link`,
      { data: { scope: "quote_view" } },
    );
    expect(wLink.ok()).toBeTruthy();
    const { token: wToken } = (await wLink.json()) as { token: string };
    const wQuote = await request.get(`${API}/portal/quote/${wToken}`);
    expect(wQuote.ok()).toBeTruthy();
    const wBody = (await wQuote.json()) as {
      tier1: { target_total_inc_gst: number } | null;
      costing: { total: number } | null;
      project: { address: string };
    };
    expect(wBody.project.address).toBe(TIER1_WRIGHTS_ADDRESS);
    expect(wBody.tier1?.target_total_inc_gst).toBe(58410.35);
    expect(wBody.costing?.total).toBe(58410.35);

    const { projectId: carltonId } = await createCarltonControlProject(
      request,
      { seedCanvas: false },
    );
    await request.post(`${API}/projects/${carltonId}/design`);
    await request.post(`${API}/projects/${carltonId}/costing`);
    const cLink = await request.post(
      `${API}/projects/${carltonId}/magic-link`,
      { data: { scope: "quote_view" } },
    );
    const { token: cToken } = (await cLink.json()) as { token: string };
    const cQuote = await request.get(`${API}/portal/quote/${cToken}`);
    expect(cQuote.ok()).toBeTruthy();
    const cBody = (await cQuote.json()) as { tier1: unknown };
    expect(cBody.tier1).toBeNull();
  });

  test("two Wrights Quote sessions both show ledger (no cross-project bleed)", async ({
    browser,
    request,
  }) => {
    const a = await createWrightsTier1Project(request);
    const b = await createWrightsTier1Project(request);

    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    await openQuoteBuilder(pageA, a.projectId);
    await openQuoteBuilder(pageB, b.projectId);

    await expect(pageA.getByTestId("tier1-quote-ledger")).toBeVisible({
      timeout: 20_000,
    });
    await expect(pageB.getByTestId("tier1-quote-ledger")).toBeVisible({
      timeout: 20_000,
    });
    await expect(pageA.getByTestId("tier1-quote-target")).toContainText(
      /\$58,410/,
    );
    await expect(pageB.getByTestId("tier1-quote-target")).toContainText(
      /\$58,410/,
    );

    await ctxA.close();
    await ctxB.close();
  });
});
