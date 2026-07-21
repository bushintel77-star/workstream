import { test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const PROJECT_ID = "618b7185-7579-4cf6-b2b2-572474916350";
const OUT = path.join(process.cwd(), "test-results", "uiux");

function shot(name: string) {
  return path.join(OUT, name);
}

test("studio uiux probe", async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 1512, height: 950 });
  test.setTimeout(180_000);

  const go = async (mode: string) => {
    await page.goto(`/projects/${PROJECT_ID}?mode=${mode}`, {
      waitUntil: "domcontentloaded",
    });
    await page
      .getByTestId("handoff-design-studio")
      .waitFor({ state: "visible", timeout: 60_000 })
      .catch(() => {});
    await page.waitForTimeout(2500);
  };

  // 1. Survey
  await go("survey");
  await page.screenshot({ path: shot("1-survey.png") });

  // 2. CAD
  await go("cad");
  await page.screenshot({ path: shot("2-cad.png") });

  // 3. Sketch + draw
  await go("sketch");
  await page.screenshot({ path: shot("3a-sketch-empty.png") });
  const board = page.getByTestId("sketch-board");
  const box = await board.boundingBox();
  if (box) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    // rough rectangle
    await page.mouse.move(cx - 160, cy - 90);
    await page.mouse.down();
    await page.mouse.move(cx + 160, cy - 92, { steps: 8 });
    await page.mouse.move(cx + 158, cy + 90, { steps: 8 });
    await page.mouse.move(cx - 162, cy + 88, { steps: 8 });
    await page.mouse.move(cx - 160, cy - 90, { steps: 8 });
    await page.mouse.up();
    // squiggle
    await page.mouse.move(cx - 60, cy);
    await page.mouse.down();
    for (let i = 0; i < 20; i++) {
      await page.mouse.move(
        cx - 60 + i * 6,
        cy + Math.sin(i / 1.5) * 30,
        { steps: 2 },
      );
    }
    await page.mouse.up();
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: shot("3b-sketch-drawn.png") });

  // 4. Fit sheet on CAD
  await go("cad");
  const fitBtn = page.getByTestId("fit-sheet-top");
  if (await fitBtn.count()) {
    await fitBtn.click().catch(() => {});
  } else {
    await page.keyboard.press("f");
  }
  await page
    .getByTestId("fit-sheet-frame")
    .waitFor({ state: "visible", timeout: 15_000 })
    .catch(() => {});
  await page.waitForTimeout(1200);
  await page.screenshot({ path: shot("4-fitsheet.png") });

  // 5. Print emulation (fit sheet still on)
  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: shot("5-print-emulation.png") });

  // 6. PDF A3 landscape
  let pdfOk = "n/a";
  try {
    await page.pdf({
      path: shot("6-a3.pdf"),
      landscape: true,
      printBackground: true,
      width: "420mm",
      height: "297mm",
    });
    pdfOk = "ok";
  } catch (e) {
    pdfOk = `err: ${(e as Error).message}`;
  }
  console.log("PDF_A3_RESULT:", pdfOk);

  // 7. reset
  await page.emulateMedia({ media: "screen" });
  await page.screenshot({ path: shot("7-reset.png") });
});
