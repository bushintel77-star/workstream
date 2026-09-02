import { test, expect } from "@playwright/test";
import path from "node:path";

test("fieldloop portal flow: sign in, approve quote, pay invoice", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const dir = path.resolve(
    __dirname,
    "../../../gui-test-screenshots/visual-pass",
  );
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

  await page.goto("/fieldloop", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("CAULFIELD SOUTH PLUMBING").first()).toBeVisible();

  // Sign in flow
  await page.fill("#accessContact", "sarah.w@email.com");
  await page.getByRole("button", { name: "Send me a secure link" }).click();
  await expect(page.getByText("Link sent — for this demo", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Continue to your account" }).click();
  await expect(page.getByText("Hi, S. Whitfield")).toBeVisible();
  await page.screenshot({ path: path.join(dir, "fl-01-portal.png") });

  // Approve the quote
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approved — $71.50", { exact: false })).toBeVisible();
  await page.screenshot({ path: path.join(dir, "fl-02-quote-approved.png") });

  // Pay the invoice
  await page.getByRole("button", { name: "Pay $214.50" }).click();
  await expect(page.getByText("Paid — thank you")).toBeVisible();
  await page.screenshot({ path: path.join(dir, "fl-03-invoice-paid.png") });

  expect(errors, `browser errors:\n${errors.join("\n")}`).toEqual([]);
});
