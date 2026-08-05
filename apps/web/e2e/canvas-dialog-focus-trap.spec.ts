import { expect, test } from "@playwright/test";
import {
  clickHeaderViewItem,
  createSurveyProject,
  createWrightsTier1Project,
  handoffStudio,
  openCommandPalette,
  seedPoolWithoutBarrier,
} from "./helpers";

/**
 * Focus-trap contract for dialogs that render their own `role="dialog"`
 * outside the RightDataLane wrapper. Each dialog must: close on Escape,
 * trap Tab/Shift+Tab inside while open, move focus in on open, and restore
 * focus on close. See `lib/use-focus-trap.ts` for the shared hook.
 *
 * Mirrors `right-data-lane-keyboard.spec.ts`'s two-test shape (Escape closes;
 * Tab/Shift+Tab stays inside) per dialog.
 *
 * Not covered here:
 * - `canvas-coach-mark` (StudioCoachMarks) — component exists but is not
 *   rendered in HandoffDesignStudio; cannot e2e test until integrated.
 * - `deck-inspector-dock` (DeckInspectorDock) — requires present mode, which
 *   requires accepted CAD geometry; complex mode progression not worth the
 *   flake risk for a focus-trap smoke. The hook wiring is covered by
 *   typecheck + the share-popup nested case below exercises the same hook.
 */
test.describe("Canvas dialog focus trap", () => {
  test.describe("Command palette", () => {
    test("Escape closes the command palette", async ({ page, request }) => {
      const { projectId } = await createSurveyProject(request);
      await page.goto(`/projects/${projectId}?mode=cad`);
      await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });

      await openCommandPalette(page);
      await expect(page.getByTestId("canvas-command-palette")).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(page.getByTestId("canvas-command-palette")).toHaveCount(0);
    });

    test("Tab wraps focus inside the command palette while open", async ({
      page,
      request,
    }) => {
      const { projectId } = await createSurveyProject(request);
      await page.goto(`/projects/${projectId}?mode=cad`);
      await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });

      await openCommandPalette(page);
      const panel = page.getByTestId("canvas-command-palette");
      await expect(panel).toBeVisible();

      // Focus should land inside the palette on open (the search input is
      // the first focusable element).
      const focusedInPanel = await page.evaluate(() => {
        const el = document.querySelector(
          '[data-testid="canvas-command-palette"]',
        );
        return Boolean(el && el.contains(document.activeElement));
      });
      expect(focusedInPanel).toBe(true);

      // Shift+Tab from the first focusable wraps to the last, not out to
      // the canvas.
      await page.keyboard.press("Shift+Tab");
      const stillInPanel = await page.evaluate(() => {
        const el = document.querySelector(
          '[data-testid="canvas-command-palette"]',
        );
        return Boolean(el && el.contains(document.activeElement));
      });
      expect(stillInPanel).toBe(true);
    });
  });

  test.describe("Sheet compose dock", () => {
    test("Escape closes the sheet compose peel", async ({ page, request }) => {
      const { projectId } = await createSurveyProject(request);
      await page.goto(`/projects/${projectId}?mode=cad`);
      await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });

      await clickHeaderViewItem(page, "fit-sheet-top");
      await expect(page.getByTestId("fit-sheet-layer")).toBeVisible({
        timeout: 10_000,
      });

      await clickHeaderViewItem(page, "sheet-compose-top");
      await expect(page.getByTestId("sheet-compose-peel")).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(page.getByTestId("sheet-compose-peel")).toHaveCount(0);
    });

    test("Tab wraps focus inside the sheet compose peel while open", async ({
      page,
      request,
    }) => {
      const { projectId } = await createSurveyProject(request);
      await page.goto(`/projects/${projectId}?mode=cad`);
      await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });

      await clickHeaderViewItem(page, "fit-sheet-top");
      await expect(page.getByTestId("fit-sheet-layer")).toBeVisible({
        timeout: 10_000,
      });

      await clickHeaderViewItem(page, "sheet-compose-top");
      const peel = page.getByTestId("sheet-compose-peel");
      await expect(peel).toBeVisible();

      const focusedInPeel = await page.evaluate(() => {
        const el = document.querySelector(
          '[data-testid="sheet-compose-peel"]',
        );
        return Boolean(el && el.contains(document.activeElement));
      });
      expect(focusedInPeel).toBe(true);

      await page.keyboard.press("Shift+Tab");
      const stillInPeel = await page.evaluate(() => {
        const el = document.querySelector(
          '[data-testid="sheet-compose-peel"]',
        );
        return Boolean(el && el.contains(document.activeElement));
      });
      expect(stillInPeel).toBe(true);
    });
  });

  test.describe("Share revision popup", () => {
    test("Escape closes the share popup", async ({ page, request }) => {
      const { projectId } = await createWrightsTier1Project(request);
      await page.goto(`/projects/${projectId}?mode=cad`);
      await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });

      // Wait for the costed BOM to load so the share button enables.
      const shareBtn = page.getByTestId("share-top");
      await expect(shareBtn).toBeEnabled({ timeout: 30_000 });
      await shareBtn.click();
      await expect(page.getByTestId("share-revision-popup")).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(page.getByTestId("share-revision-popup")).toHaveCount(0);
    });

    test("Tab wraps focus inside the share popup while open", async ({
      page,
      request,
    }) => {
      const { projectId } = await createWrightsTier1Project(request);
      await page.goto(`/projects/${projectId}?mode=cad`);
      await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });

      const shareBtn = page.getByTestId("share-top");
      await expect(shareBtn).toBeEnabled({ timeout: 30_000 });
      await shareBtn.click();
      const popup = page.getByTestId("share-revision-popup");
      await expect(popup).toBeVisible();

      const focusedInPopup = await page.evaluate(() => {
        const el = document.querySelector(
          '[data-testid="share-revision-popup"]',
        );
        return Boolean(el && el.contains(document.activeElement));
      });
      expect(focusedInPopup).toBe(true);

      await page.keyboard.press("Shift+Tab");
      const stillInPopup = await page.evaluate(() => {
        const el = document.querySelector(
          '[data-testid="share-revision-popup"]',
        );
        return Boolean(el && el.contains(document.activeElement));
      });
      expect(stillInPopup).toBe(true);
    });

    test("Escape does not close the share popup while the safety waiver is open", async ({
      page,
      request,
    }) => {
      // Seed a pool with no barrier — this triggers the required safety waiver
      // disclaimer (board-liability.ts: poolUnbarriered), so the share popup
      // opens SafetyWaiverConfirm on "Share new revision".
      const { projectId } = await createWrightsTier1Project(request, {
        seedCanvas: false,
      });
      await seedPoolWithoutBarrier(request, projectId);

      await page.goto(`/projects/${projectId}?mode=cad`);
      await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });

      const shareBtn = page.getByTestId("share-top");
      await expect(shareBtn).toBeEnabled({ timeout: 30_000 });
      await shareBtn.click();
      const popup = page.getByTestId("share-revision-popup");
      await expect(popup).toBeVisible();

      // Click "Share new revision" to trigger the safety waiver confirm.
      const issueBtn = page.getByTestId("share-new-revision");
      await expect(issueBtn).toBeVisible();
      await issueBtn.click();
      const waiver = page.getByTestId("safety-waiver-confirm");
      await expect(waiver).toBeVisible({ timeout: 15_000 });

      // Both dialogs are open: Escape should close the waiver, not the popup.
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("safety-waiver-confirm")).toHaveCount(0);
      // The popup must survive — the waiver's Escape must not propagate.
      await expect(popup).toBeVisible();
    });
  });
});
