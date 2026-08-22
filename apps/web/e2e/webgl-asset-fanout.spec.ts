import { test, expect, type ConsoleMessage } from "@playwright/test";
import { createAddressProject } from "./helpers";

/**
 * Asset Discovery Fan-Out e2e (Gap 5 part 2).
 *
 * Verifies the full place-and-persist loop on the WebGL studio:
 *   1. The Assets chip opens the fan-out dock with real catalog cards.
 *   2. Picking a card arms it (gold active card + hint).
 *   3. Clicking the canvas places the item — stats Items increments to 1.
 *   4. Reloading the page rehydrates the placement (Items: 1 persists —
 *      the autosave PUT round-trip).
 *   5. No fatal console errors.
 */
test.describe("WebGL asset fan-out (place + persist)", () => {
  test("pick a card, click the lot, item persists across reload", async ({
    page,
    request,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg: ConsoleMessage) => {
      if (msg.type() === "error") errors.push(msg.text().slice(0, 300));
    });
    page.on("pageerror", (err: Error) =>
      errors.push(`${err.name}: ${err.message.slice(0, 300)}`),
    );

    const { projectId } = await createAddressProject(request, {
      address: "1 Asset Fanout Street, Melbourne VIC 3000",
    });

    await page.goto(`/projects/${projectId}?webgl=1`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(4000);

    await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
      timeout: 10_000,
    });

    // 1. Open the dock.
    await page.getByRole("button", { name: "▸ Assets" }).click();
    const dock = page.locator('[data-testid="asset-dock"]');
    await expect(dock).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[data-testid="asset-card-bluestone-paver"]')).toBeVisible();

    // 2. Arm the paver — a HARDSCAPE symbol (plants now open the flora ring,
    //    which has its own spec; this spec pins the direct-place + persist path).
    await page.locator('[data-testid="asset-card-bluestone-paver"]').click();
    await expect(dock).toContainText("Armed", { timeout: 5_000 });

    // 3. Click the lot centre — one item placed. The perimeter strip holds
    //    the live B/I/S state (the identity chip is now the first glass
    //    card in DOM order, so pin the assertion to the strip itself).
    const canvas = page.locator('[data-testid="webgl-canvas"]');
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    const stats = page.locator('[data-testid="perimeter-tab-strip"]');
    await expect(stats).toContainText("I1", { timeout: 10_000 });

    // Wait for the debounced autosave to persist BEFORE reloading (a real
    // operator sees the save chip; reloading inside the 1.1s debounce would
    // race the PUT — the beforeunload guard warns a human, not a test).
    await expect(stats).toContainText(/Saved/, { timeout: 15_000 });

    // 4. Reload — the placement rehydrates from the persisted canvas.
    // domcontentloaded (not networkidle): production keeps background
    // polling alive, so networkidle never settles there.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
      timeout: 15_000,
    });
    // Wait for the autosave round-trip to complete — the save-status-chip
    // transitions through saving → saved after hydration, which is a more
    // reliable signal than a fixed timeout or the stats strip text (which
    // can render before the canvas rehydrates).
    await expect(
      page.locator('[data-testid="save-status-chip"][data-status="saved"]'),
    ).toBeVisible({ timeout: 20_000 });
    const statsAfter = page.locator('[data-testid="perimeter-tab-strip"]');
    await expect(statsAfter).toContainText("I1", { timeout: 10_000 });

    // 5. No fatal console errors.
    const fatal = errors.filter(
      (e) =>
        e.includes("Maximum update depth") ||
        e.includes("TypeError") ||
        e.includes("ReferenceError"),
    );
    expect(fatal, `Fatal console errors:\n${fatal.join("\n")}`).toHaveLength(0);
  });
});
