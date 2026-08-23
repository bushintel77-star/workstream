import { expect, test, type ConsoleMessage } from "@playwright/test";
import { randomUUID } from "crypto";
import { createAddressProject } from "./helpers";

const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/**
 * WebGL marquee box select — the tool-gated drag that closes the inspector
 * loop. One drag over mass placements lands in the inspector's read-only
 * many-refs summary; the tool gate means plain drags still pan when the
 * marquee tool is disarmed (covered by the pan-commit spec).
 */

test.describe("WebGL marquee box select", () => {
  test("a drag box selects placements, lands in the summary card, and never pans", async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on("console", (m: ConsoleMessage) => {
      if (m.type() === "error") errors.push(m.text().slice(0, 300));
    });
    page.on("pageerror", (err: Error) =>
      errors.push(`${err.name}: ${err.message.slice(0, 300)}`),
    );

    const { projectId } = await createAddressProject(request, {
      address: "1 Marquee Street, Melbourne VIC 3000",
    });

    // Two placements tight to the board centre (clickable at the canvas
    // centre in the default plan rig — the sketch-to-cad spec contract) and
    // one far placement that must never enter the box.
    const seed = await request.put(
      `${API}/projects/${projectId}/design-canvas`,
      {
        data: {
          placements: [
            {
              id: randomUUID(),
              symbol_id: "olive-standard",
              x_pct: 49,
              y_pct: 49,
              rotation_deg: 0,
              scale: 1,
            },
            {
              id: randomUUID(),
              symbol_id: "olive-standard",
              x_pct: 51,
              y_pct: 51,
              rotation_deg: 0,
              scale: 1,
            },
            {
              id: randomUUID(),
              symbol_id: "olive-standard",
              x_pct: 10,
              y_pct: 10,
              rotation_deg: 0,
              scale: 1,
            },
          ],
          strokes: [],
        },
      },
    );
    expect(seed.ok()).toBeTruthy();

    // Sketch mode: the mode whose event plumbing is proven end-to-end by
    // the sketch-to-cad spec (rail clicks + canvas-centre ground gestures,
    // with the mode panel mounted). Cad mode is deliberately avoided here:
    // its always-open drafter panel covers the board centre (a pre-existing
    // chrome issue, flagged in the differentiator backlog — closing it is a
    // product call, not marquee scope).
    await page.goto(`/projects/${projectId}?mode=sketch`, {
      waitUntil: "networkidle",
    });
    await expect(page.getByTestId("webgl-studio")).toBeVisible({
      timeout: 30_000,
    });

    // Arm the marquee tool from the rail.
    await page.getByTestId("rail-marquee").click();

    const canvas = page.getByTestId("webgl-canvas");
    // The R3F canvas mounts asynchronously after the studio shell — wait for
    // it to lay out before reading its box (a null box throws mid-gesture).
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    const box = (await canvas.boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // Drag a box around the board centre: the two centre placements fall
    // inside; the far (10,10) placement must not.
    await page.mouse.move(cx - 100, cy - 100);
    await page.mouse.down();
    await page.mouse.move(cx + 100, cy + 100, { steps: 6 });
    await page.mouse.up();

    await expect(page.getByTestId("selection-count")).toContainText(
      "2 selected",
      { timeout: 10_000 },
    );
    // The inspector's many-refs read-only summary is the landing state —
    // one drag replaces the shift-click loop.
    await expect(
      page.getByText("Select one entity to edit its properties"),
    ).toBeVisible();

    // Esc clears.
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("selection-chip")).toHaveCount(0);

    // Second identical drag (tool still armed, camera un-panned — a pan
    // would have moved the board centre off the box): replace path selects
    // the same two placements.
    await page.mouse.move(cx - 100, cy - 100);
    await page.mouse.down();
    await page.mouse.move(cx + 100, cy + 100, { steps: 6 });
    await page.mouse.up();
    await expect(page.getByTestId("selection-count")).toContainText(
      "2 selected",
      { timeout: 10_000 },
    );

    // Shift-additive over the same box: the union dedupes — still exactly 2.
    await page.keyboard.down("Shift");
    await page.mouse.move(cx - 100, cy - 100);
    await page.mouse.down();
    await page.mouse.move(cx + 100, cy + 100, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.up("Shift");
    await expect(page.getByTestId("selection-count")).toContainText(
      "2 selected",
    );

    // No fatal console errors during the whole gesture sequence.
    const fatal = errors.filter(
      (e) =>
        e.includes("Maximum update depth") ||
        e.includes("TypeError") ||
        e.includes("ReferenceError"),
    );
    expect(fatal, `Fatal console errors:\n${fatal.join("\n")}`).toHaveLength(0);
  });
});
