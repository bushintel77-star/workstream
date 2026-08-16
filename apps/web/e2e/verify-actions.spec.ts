import { test, expect, type ConsoleMessage } from "@playwright/test";

test("/home server actions work on fresh load", async ({ browser }) => {
  const errors: string[] = [];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") errors.push(msg.text().slice(0, 300));
  });
  page.on("pageerror", (err: Error) => errors.push(`${err.name}: ${err.message.slice(0, 300)}`));

  await page.goto("http://127.0.0.1:3002/home", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);

  // The weather widget loads via getWeatherAction server action — check it rendered.
  const weatherLabel = await page.locator("text=Weather").count();
  console.log(`Weather widget present: ${weatherLabel > 0}`);
  console.log(`Errors: ${errors.length}`);
  for (const e of errors) console.log(`  ERROR: ${e}`);

  const invalidActions = errors.filter((e) =>
    e.includes("Invalid Server Actions") || e.includes("Maximum update"),
  );
  expect(invalidActions).toHaveLength(0);
  await ctx.close();
});
