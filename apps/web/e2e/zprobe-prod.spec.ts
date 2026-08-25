import { test } from "@playwright/test";

/** Capture the PRODUCTION home dashboard to see what's actually live. */
test("capture production home", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 950 });
  await page.goto("https://web-production-3c194.up.railway.app/home", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(3000);
  const bodyText = await page.locator("body").textContent();
  const hasTheatre = /DWG-001|1:200|north/i.test(bodyText ?? "");
  console.log("HAS_DRAFTING_THEATRE:", hasTheatre);
  const cardCount = await page.locator('[class*="cardName"]').count();
  console.log("CARD_COUNT:", cardCount);
  await page.screenshot({ path: "apps/web/shots-prod/prod-home.png" });
  console.log("PROD_CAPTURE_DONE");
});
