import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/**
 * Dashboard — seed N projects; hard-expect search empty / match / Dialog delete + undo.
 * Filter chips and sort buttons were removed from live /home (editorial redesign);
 * those soft branches are gone — this file covers the surfaces that ship today.
 */
test.describe("Dashboard — search, delete, undo", () => {
  test("seeded projects: search empty/match, Dialog delete, Undo restores", async ({
    page,
    request,
  }) => {
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
