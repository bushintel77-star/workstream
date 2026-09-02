import { test, expect } from "@playwright/test";
import path from "node:path";

test("schedule sheet opens from the command palette", async ({ page }) => {
  test.setTimeout(180_000);
  const dir = path.resolve(__dirname, "../../../gui-test-screenshots/visual-pass");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto(
    "/projects/27c18300-4cb8-4323-9e4b-b2d91d3f20c5",
    { waitUntil: "domcontentloaded" },
  );
  await expect(page.getByTestId("scale-toggle")).toBeVisible({ timeout: 150_000 });

  await page.keyboard.press("Control+k");
  await page.waitForTimeout(400);
  await page.keyboard.type("schedule");
  await page.waitForTimeout(400);
  await page.keyboard.press("Enter");
  const sheet = page.getByTestId("schedule-sheet");
  await expect(sheet).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: path.join(dir, "fl-04-schedule-sheet.png") });
  await expect(page.getByText("LIVE FROM CANVAS")).toBeVisible();
  expect(errors, `browser errors:\n${errors.join("\n")}`).toEqual([]);
});
