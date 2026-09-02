import { test } from "@playwright/test";
import path from "node:path";

test("live check: current canvas state", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  const target = process.env.LIVE_PROJECT_PAGE ?? "/";
  await page.goto(target, { waitUntil: "domcontentloaded" });
  // Give the studio time to mount + paint.
  await page.waitForTimeout(12_000);
  await page.screenshot({
    path: path.resolve(
      __dirname,
      "../../../gui-test-screenshots/visual-pass/live-current.png",
    ),
    fullPage: false,
  });
  console.log(`errors: ${errors.join(" | ") || "none"}`);
  console.log(`url: ${page.url()}`);
});
