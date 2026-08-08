import { test, expect } from "@playwright/test";
import { createSurveyProject, handoffStudio } from "./helpers";

/**
 * Tier-1 2026 — Share stays locked until something is costed.
 * Full string matrix is unit-tested in modeLockCopy.test.ts.
 */
test.describe("Mode lock copy", () => {
  test("Share mode stays locked with spec copy until costed", async ({
    page,
    request,
  }) => {
    const { projectId } = await createSurveyProject(request);
    await page.goto(`/projects/${projectId}?mode=survey`);
    await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });

    const share = page.getByTestId("canvas-mode-share");
    await expect(share).toBeVisible({ timeout: 15_000 });
    await expect(share).toBeDisabled();
    await expect(share).toHaveAttribute(
      "title",
      "Cost something on the drawing before sharing.",
    );
  });
});
