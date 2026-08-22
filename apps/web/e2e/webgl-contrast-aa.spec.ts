import { expect, test } from "@playwright/test";
import {
  createWrightsTier1Project,
  seedElevationGarden,
} from "./helpers";
import { contrastFailures } from "./contrast-helpers";

const MODES = ["survey", "sketch", "cad", "elevation", "quote"] as const;

test("active WebGL chrome keeps all visible text at or above AA", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const { projectId } = await createWrightsTier1Project(request, {
    seedCanvas: true,
  });
  await seedElevationGarden(request, projectId);
  await page.setViewportSize({ width: 1600, height: 950 });

  const report: string[] = [];
  for (const mode of MODES) {
    const waitUntil = mode === "quote" ? "domcontentloaded" : "networkidle";
    await page.goto(`/projects/${projectId}?mode=${mode}`, {
      waitUntil,
    });
    await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
      timeout: 30_000,
    });
    await page.waitForTimeout(1500);
    for (const failure of await contrastFailures(page)) {
      report.push(
        `${mode}: ${failure.ratio}:1 (needs ${failure.need}) ${failure.size}px ` +
          `${failure.fg} on ${failure.bg} — "${failure.text}" [${failure.cls}]`,
      );
    }
  }

  expect(
    report,
    `Active WebGL WCAG AA failures:\n${report.join("\n")}`,
  ).toEqual([]);
});
