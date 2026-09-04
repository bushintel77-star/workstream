import { test, expect } from "@playwright/test";
import { createAddressProject } from "./helpers";

/**
 * Motion-aware chrome recede e2e (AEC-2026 rollout Wave 3).
 *
 * The auto-recede (camera orbit) is driven per-frame by the R3F watcher;
 * the deterministic, user-facing path is the hold-H peek, which shares the
 * exact same body class and CSS. This spec proves:
 *
 *   1. Holding H fades the chrome (body class + computed opacity at the
 *      recede token value).
 *   2. Releasing H restores full opaque paper.
 *   3. The ? shortcut sheet documents the peek.
 */

test.describe("Motion-aware chrome recede", () => {
  test("hold-H peek fades chrome and release restores it", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    const { projectId } = await createAddressProject(request, {
      address: "1 Peek Street, Melbourne VIC 3000",
    });
    await page.goto(`/projects/${projectId}?webgl=1`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
      timeout: 15_000,
    });

    const chromeLayer = page.locator('[data-cf-layer="chrome"]').first();
    await expect(chromeLayer).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("body")).not.toHaveClass(/gs-chrome-receding/);

    // Hold — class lands and the chrome layer composites at the recede token
    // value. Asserted AGAINST THE TOKEN (--ws-op-recede), not a copied
    // literal: the token was tuned (0.55 → 0.28) after this spec was written
    // and the stale literal kept the gate red through no product fault.
    const recedeToken = await page.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue("--ws-op-recede").trim(),
    );
    expect(recedeToken, "--ws-op-recede must be defined in tokens.css").not.toBe("");

    await page.keyboard.down("h");
    await expect(page.locator("body")).toHaveClass(/gs-chrome-receding/);
    await expect
      .poll(async () =>
        chromeLayer.evaluate((el) => parseFloat(getComputedStyle(el).opacity)),
      )
      .toBeCloseTo(parseFloat(recedeToken), 5);

    // Release — full opaque paper returns.
    await page.keyboard.up("h");
    await expect(page.locator("body")).not.toHaveClass(/gs-chrome-receding/);
    await expect
      .poll(async () => chromeLayer.evaluate((el) => getComputedStyle(el).opacity))
      .toBe("1");

    // The shortcut sheet documents the peek.
    await page.keyboard.press("?");
    const help = page.locator('[data-testid="studio-shortcuts-help"]');
    await expect(help).toBeVisible({ timeout: 5_000 });
    await expect(help).toContainText("Peek");
  });
});
