import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { API, waitForApiReady } from "./helpers";

/**
 * Dashboard — seed N projects; hard-expect search empty / match, sort order,
 * and Dialog delete + undo. Status filter chips were removed from live /home
 * (editorial redesign); the sort control is back as a select, so it is covered.
 */
test.describe("Dashboard — search, sort, delete, undo", () => {
  test("seeded projects: search empty/match, Dialog delete, Undo restores", async ({
    page,
    request,
  }) => {
    await waitForApiReady(request);
    const run = randomUUID().slice(0, 8);
    const seeds = [
      { name: `E2E Alpha ${run}`, street: "101 Filter St" },
      { name: `E2E Beta ${run}`, street: "202 Sort Ave" },
      { name: `E2E Gamma ${run}`, street: "303 Search Rd" },
    ];
    for (const s of seeds) {
      const create = await request.post(`${API}/projects/`, {
        data: {
          address: `${s.name}, ${s.street}, Melbourne VIC 3000`,
          lat: -37.8136,
          lng: 144.9631,
        },
      });
      expect(create.ok()).toBeTruthy();
    }

    await page.goto("/home");
    await expect(page).toHaveURL(/\/home/);

    const search = page.getByRole("searchbox", { name: "Search projects" });
    await expect(search).toBeVisible({ timeout: 15_000 });

    const cardName = (label: string) =>
      page.locator('[class*="cardName"]', { hasText: label });

    await expect(cardName(seeds[0]!.name)).toBeVisible();
    await expect(cardName(seeds[1]!.name)).toBeVisible();
    await expect(cardName(seeds[2]!.name)).toBeVisible();

    await search.fill("zzz-nonexistent-project");
    await expect(
      page.getByRole("heading", { name: "No matching projects" }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(cardName(seeds[0]!.name)).toHaveCount(0);

    await search.fill(seeds[0]!.street);
    await expect(cardName(seeds[0]!.name)).toBeVisible({ timeout: 5_000 });
    await expect(cardName(seeds[1]!.name)).toHaveCount(0);
    await expect(cardName(seeds[2]!.name)).toHaveCount(0);

    // Sort — scope to this run's three seeds so the order is deterministic
    // against a store that already holds unrelated projects.
    await search.fill(run);
    const runCards = page.locator('[class*="cardName"]');
    await expect(runCards).toHaveCount(3, { timeout: 5_000 });
    const sortSelect = page.getByRole("combobox", { name: "Sort projects" });
    await sortSelect.selectOption("name");
    await expect(runCards).toHaveText([
      seeds[0]!.name,
      seeds[1]!.name,
      seeds[2]!.name,
    ]);
    await sortSelect.selectOption("activity");

    await search.clear();
    await expect(cardName(seeds[1]!.name)).toBeVisible({ timeout: 5_000 });

    const deleteBtn = page.getByRole("button", {
      name: `Delete ${seeds[1]!.name}`,
    });
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    const dialog = page.getByTestId("dialog-panel");
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Delete project?")).toBeVisible();
    await expect(
      dialog.getByText(seeds[1]!.name, { exact: true }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(cardName(seeds[1]!.name)).toBeVisible();

    await deleteBtn.click();
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await dialog.getByRole("button", { name: "Delete" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(cardName(seeds[1]!.name)).toHaveCount(0);

    const toastRegion = page.locator("[aria-live]").filter({
      hasText: "Project deleted",
    });
    await expect(toastRegion).toBeVisible({ timeout: 10_000 });
    await expect(
      toastRegion.getByRole("button", { name: "Undo" }),
    ).toBeVisible();
    await toastRegion.getByRole("button", { name: "Undo" }).click();

    await expect(cardName(seeds[1]!.name)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Project restored")).toBeVisible({
      timeout: 10_000,
    });
  });
});
