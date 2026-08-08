import { expect, test } from "@playwright/test";
import { createSurveyProject } from "./helpers";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/**
 * Portal deposit token shell — seed quote revision, visit /portal/deposit/[token]
 * with real copy (not heading-only). Success/cancel pages assert meaningful copy.
 */
test.describe("Portal deposit token", () => {
  test("seeded deposit token shows checkout preview; success/cancel copy", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);

    expect(
      (await request.post(`${API}/projects/${projectId}/design`)).ok(),
    ).toBeTruthy();
    expect(
      (await request.post(`${API}/projects/${projectId}/costing`)).ok(),
    ).toBeTruthy();

    const link = await request.post(
      `${API}/projects/${projectId}/magic-link`,
      { data: { scope: "quote_view" } },
    );
    expect(link.ok()).toBeTruthy();
    const { token: quoteToken } = (await link.json()) as { token: string };

    const quote = await request.get(`${API}/portal/quote/${quoteToken}`);
    expect(quote.ok()).toBeTruthy();
    const quoteBody = (await quote.json()) as {
      deposit_url: string | null;
      costing: { total: number } | null;
    };
    expect(quoteBody.deposit_url).toMatch(/\/portal\/deposit\//);
    expect(quoteBody.costing?.total).toBeGreaterThan(0);

    const depositToken = new URL(quoteBody.deposit_url ?? "").pathname
      .split("/")
      .pop();
    expect(depositToken).toBeTruthy();
    expect(depositToken).not.toBe(quoteToken);

    await page.goto(`/portal/deposit/${depositToken}`);
    await expect(page.getByText("CHECKOUT PREVIEW")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /deposit noted/i,
    );
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /\$[\d,]+\.\d{2}/,
    );
    await expect(
      page.getByText(/Secure card checkout is not accepting live payments yet/i),
    ).toBeVisible();
    await expect(
      page.getByText(/No payment is taken in this preview mode/i),
    ).toBeVisible();
    await expect(page.getByText("Workstream").first()).toBeVisible();
    await expect(page.getByText("DEPOSIT", { exact: true })).toBeVisible();

    // Wrong scope (quote_view token) must not open checkout preview.
    await page.goto(`/portal/deposit/${quoteToken}`);
    await expect(
      page.getByRole("heading", { name: /Couldn't open checkout/i }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(/This deposit link is not available right now/i),
    ).toBeVisible();

    await page.goto("/portal/deposit-success");
    await expect(page.getByText("DEPOSIT RECEIVED")).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByRole("heading", {
        name: /Thank you\. Your deposit is confirmed\./i,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(/We will reconcile the payment and confirm your project/i),
    ).toBeVisible();
    await expect(page.getByText("NEXT STEP")).toBeVisible();

    await page.goto("/portal/deposit-cancel");
    await expect(page.getByText("CHECKOUT CANCELLED")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("NO PAYMENT TAKEN")).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /Your deposit checkout was cancelled\./i,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(/No charge has been made/i),
    ).toBeVisible();
    await expect(
      page.getByText(/secure quote link again when you are ready/i),
    ).toBeVisible();
  });
});
