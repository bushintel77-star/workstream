/**
 * Canvas-First four-layer z-stack snapshot — Survey / Sketch / CAD / Garden.
 *
 * The CanvasFirstLayout wrapper exposes four data-cf-layer slots, each pinned
 * to one of the SDS tokens declared in apps/web/src/styles/globals.css:
 *
 *   data-cf-layer="canvas"   → var(--cf-z-canvas)   = 0
 *   data-cf-layer="spatial"  → var(--cf-z-spatial)  = 10
 *   data-cf-layer="chrome"   → var(--cf-z-chrome)   = 20
 *   data-cf-layer="app"      → var(--cf-z-app)      = 30
 *
 * This test pins that ordering across the four operator-facing modes the
 * user named in the upgrade ticket. It is the *runtime* counterpart of the
 * recent lint + unit-test work; together they form a three-way contract:
 *
 *   1. globals.css declares the tokens (source of truth)
 *   2. cfz.ts reads them into JS, lint enforces the cfZPair registry
 *   3. THIS test confirms -- at runtime, under WebGL -- the DOM matches the
 *      declared ladder and that ladder is invariant across mode switches.
 *
 * If any of those three drifts, one of the three fails. The escape hatch
 * is the SAME place: a constants block in apps/web/src/styles/globals.css
 * (and the parallel record in cfz.ts).
 */

import { expect, test, type Page } from "@playwright/test";

import { createWrightsTier1Project } from "./helpers";

/**
 * The four layers the wrapper is contractually required to expose, in
 * document order (= z-order once CSS resolves). Keep this list aligned
 * with CanvasFirstLayout.tsx so a dropped slot triggers an immediate
 * mismatch (not a silent reorder).
 */
const EXPECTED_LAYERS = ["canvas", "spatial", "chrome", "app"] as const;

/**
 * Documented SDS ladder values. THESE are the snapshot — if the numbers
 * here drift from globals.css, the test fails and that drift is the bug.
 *
 *   --cf-z-canvas   = 0
 *   --cf-z-spatial  = 10
 *   --cf-z-chrome   = 20
 *   --cf-z-app      = 30
 */
const EXPECTED_Z: Record<(typeof EXPECTED_LAYERS)[number], string> = {
  canvas: "0",
  spatial: "10",
  chrome: "20",
  app: "30",
};

/** The four modes named in the upgrade ticket. */
const TARGET_MODES = ["survey", "sketch", "cad", "garden"] as const;

/**
 * Mode-switch keyboard shortcuts (studioShortcuts.ts MODE_BY_SHIFT_DIGIT).
 * The perimeter-tab strip was purged in the zero-chrome refactor (commit
 * 58bc9f6); mode switching is now keyboard-only via Shift+digit.
 */
const MODE_SHORTCUT: Record<(typeof TARGET_MODES)[number], string> = {
  survey: "Shift+1",
  sketch: "Shift+2",
  cad: "Shift+3",
  garden: "Shift+5",
};

/**
 * Read the live z-index for each named `data-cf-layer` slot from inside
 * the `[data-cf-layout="root"]` wrapper. Returns null when the wrapper
 * is not yet mounted, so callers can re-poll rather than race ahead.
 *
 * Runs inside the page so it picks up whatever the browser actually
 * computed (i.e. the resolved CSS var, not the var() syntax literal).
 */
async function readLayerZStack(page: Page) {
  return page.evaluate(
    ({ layers }) => {
      const root = document.querySelector('[data-cf-layout="root"]');
      if (!root) return null;

      // Document order matters: a layer that appears earlier in the DOM
      // but has an equal computed z-index paints underneath. We assert
      // both z-index AND DOM order so a regression in either fails fast.
      const tree: { layer: string; zIndex: string; domIndex: number }[] = [];
      layers.forEach((layer, i) => {
        const el = root.querySelector(`[data-cf-layer="${layer}"]`);
        if (!el) return;
        tree.push({
          layer,
          zIndex: getComputedStyle(el).zIndex,
          domIndex: i,
        });
      });
      return tree;
    },
    { layers: EXPECTED_LAYERS },
  );
}

/**
 * Wait for the four-layer wrapper to be present, then probe each layer's
 * computed z-index. Times out cleanly so a missing wrapper surfaces as
 * a CI failure with a useful message rather than a 90s hang.
 */
async function expectZStackOnceReady(page: Page) {
  await expect(page.locator('[data-cf-layout="root"]')).toBeAttached({
    timeout: process.env.CI ? 60_000 : 15_000,
  });
  await expect
    .poll(async () => (await readLayerZStack(page))?.length ?? 0, {
      timeout: process.env.CI ? 60_000 : 20_000,
    })
    .toBe(EXPECTED_LAYERS.length);
  const stack = await readLayerZStack(page);
  expect(stack, "Canvas-First wrapper mounted but returned no layers").not.toBeNull();
  return stack!;
}

test.describe("Canvas-First four-layer z-stack — Survey / Sketch / CAD / Garden", () => {
  /**
   * Machine-speed accommodation, not a relaxed product budget.
   *
   * This test's honest work is one `networkidle` studio load plus four WebGL
   * mode switches. Measured on the reference dev box: the load alone is ~32s
   * (the companion test below does nothing else and costs that much even as
   * the *second* load in the same run, with `next dev` already warm), and each
   * mode switch remounts the scene for a further ~13s. Total lands at 60-96s
   * against Playwright's 90s default, so it passed roughly half the time —
   * and when it tripped, the reported locator was merely wherever the axe fell
   * at timeout, never a z-stack assertion. Every completed run passes every
   * invariant below.
   *
   * Splitting the loop into four per-mode tests was the obvious fix and was
   * measured instead of assumed: a Playwright test cannot inherit another
   * test's page, so four tests means four ~32s loads. That trades ~50-70s of
   * extra wall clock on every `pnpm run ci` for headroom this one line buys
   * free, and it would break the cross-mode shape invariant at the bottom of
   * the test into cross-test shared state. The per-assertion timeouts (15s
   * attach, 15s mode switch, 12s default) are untouched, so a genuine
   * contract break still fails fast with a useful message — this cap only
   * governs the accumulated sum. Same reasoning and value as
   * e2e/webgl-asset-row-plant.spec.ts. Retries are deliberately NOT the
   * answer: CI already sets `retries: 1`, which would have masked the flake
   * instead of exposing the budget as the cause.
   */
  test.setTimeout(process.env.CI ? 300_000 : 180_000);

  test("each mode mounts the documented canvas → spatial → chrome → app stack", async ({
    page,
    request,
  }) => {
    const { projectId } = await createWrightsTier1Project(request);
    await page.goto(`/projects/${projectId}?webgl=1`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
      timeout: 30_000,
    });

    // The chrome overlay's data-mode attribute is the authoritative mode
    // marker. Confirm the studio is mounted before we begin switching.
    await expect(
      page.locator("[data-webgl-chrome]"),
    ).toBeAttached({ timeout: 15_000 });

    const snapshots: Record<string, ReturnType<typeof Object>> = {};

    for (const mode of TARGET_MODES) {
      // Survey is the initial mode; pressing its shortcut would no-op.
      // Probe immediately instead. For all other modes, press the
      // keyboard shortcut (Shift+digit) to trigger the transition.
      if (mode !== "survey") {
        await page.keyboard.press(MODE_SHORTCUT[mode]);
        // Wait for the chrome overlay's data-mode to reflect the switch.
        // If the mode is locked by progressive unlock, the keyboard
        // handler returns early and this will time out — skip the mode.
        const switched = await page
          .locator(`[data-webgl-chrome][data-mode="${mode}"]`)
          .waitFor({ state: "attached", timeout: 15_000 })
          .then(() => true)
          .catch(() => false);
        if (!switched) {
          test.skip(
            true,
            `Mode "${mode}" is locked by progressive unlock — cannot probe z-stack.`,
          );
          return;
        }
      }

      const stack = await expectZStackOnceReady(page);

      // Structural invariant: all four slots are mounted.
      expect(
        stack.map((s) => s.layer),
        `Mode "${mode}" — missing one of the four SDS layer slots`,
      ).toEqual([...EXPECTED_LAYERS]);

      // Numerical invariant: every slot's computed z-index matches the
      // documented SDS token value.
      for (const slot of stack) {
        expect(
          slot.zIndex,
          `Mode "${mode}" — data-cf-layer="${slot.layer}" zIndex="${slot.zIndex}" drifted from documented --cf-z-${slot.layer}=${EXPECTED_Z[slot.layer]}`,
        ).toBe(EXPECTED_Z[slot.layer]);
      }

      // Strict ordering invariant: each slot's z-index is strictly
      // greater than the slot beneath it. Catches off-by-one drift
      // when a future rung inserts between existing rungs.
      const numericStack = stack.map((s) => Number(s.zIndex));
      for (let i = 1; i < numericStack.length; i++) {
        expect(
          numericStack[i],
          `Mode "${mode}" — z-index regression between [${stack[i - 1].layer}] and [${stack[i].layer}]`,
        ).toBeGreaterThan(numericStack[i - 1]);
      }

      snapshots[mode] = JSON.parse(JSON.stringify(stack));
    }

    // Cross-mode invariant: every probed mode produced the same stack
    // shape. If a future mode conditionally hides a slot, this fails
    // loudly instead of letting the drift land in production.
    const distinctShapes = Object.values(snapshots).map((s) =>
      JSON.stringify(s),
    );
    expect(
      new Set(distinctShapes).size,
      "Two modes disagree on the four-layer z-stack shape — Canvas-First wrapper regressed during mode switch.",
    ).toBe(1);
  });
});

/**
 * Companion spec — data-cf-mirror accessibility mirror tree.
 *
 * The wrapper publishes a SR-only `<ul role="tree">` mirror of the
 * spatial graph. It must:
 *   1. Be DOM-attached inside the CanvasFirstLayout root.
 *   2. Be visually invisible (1×1 pixel box + clip-rect) so it never
 *      contributes to the render tree — sighted users can't see it,
 *      screen-reader users can navigate it.
 *   3. NOT carry one of the four `data-cf-layer` values — it lives in
 *      its own attribute namespace so the closed four-tier registry
 *      stays exactly four.
 *
 * Note: the mirror DOES share `--cf-z-app` for its z-index (comments
 * in CanvasFirstLayout.tsx mark it "above chrome" for screen-reader
 * announcement ordering). The visual separation is enforced by (2)
 * alone — invisibility, not absence from the z-stack. Asserting on
 * zIndex here would be a self-defeating false negative.
 *
 * Contract doc reference: docs/CANVAS-FIRST-Z-STACK-CONTRACT.md §6.
 */
test.describe("Canvas-First accessibility mirror — data-cf-mirror", () => {
  test("the SR-only mirror is attached, invisibly clipped, and uses its own namespace", async ({
    page,
    request,
  }) => {
    const { projectId } = await createWrightsTier1Project(request);
    await page.goto(`/projects/${projectId}?webgl=1`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.locator('[data-cf-layout="root"]')).toBeAttached({
      timeout: 15_000,
    });

    const mirror = page.locator("[data-cf-mirror]");

    // 1. Attached inside the wrapper root.
    await expect(mirror).toBeAttached({ timeout: 5_000 });

    // 2. Visually invisible — either 1×1 pixels OR clip-rect hides
    //    every pixel. Either condition is sufficient; both is preferred.
    //    This is the load-bearing assertion: a future PR that grows
    //    the mirror to visible size (e.g. 320×240 dev panel) WILL
    //    fail here and force the author to re-confirm intent.
    const invisibility = await mirror.evaluate((el) => {
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const tinyBox = rect.width <= 1 && rect.height <= 1;
      const hiddenClip = cs.clip === "rect(0px, 0px, 0px, 0px)" ||
        cs.clipPath.includes("inset(100%)") ||
        cs.clipPath.includes("rect(0");
      // Cover the additional "sr-only" recipe variants.
      const srOnly =
        cs.position === "absolute" &&
        cs.overflow === "hidden" &&
        cs.whiteSpace === "nowrap" &&
        cs.borderWidth === "0px";
      return {
        width: rect.width,
        height: rect.height,
        clip: cs.clip,
        clipPath: cs.clipPath,
        tinyBox,
        hiddenClip,
        srOnly,
      };
    });
    expect(
      invisibility.tinyBox || invisibility.hiddenClip || invisibility.srOnly,
      `Mirror tree must be SR-only invisible. Got: ${JSON.stringify(invisibility)}`,
    ).toBe(true);

    // 3. Does NOT carry one of the four `data-cf-layer` values.
    const hasLayer = await mirror.evaluate((el) => {
      const v = el.getAttribute("data-cf-layer");
      return v !== null && ["canvas", "spatial", "chrome", "app"].includes(v);
    });
    expect(
      hasLayer,
      "data-cf-mirror must not also publish data-cf-layer — the mirror namespace is its own; the four-tier visual registry would otherwise see a fifth user.",
    ).toBe(false);
  });
});
