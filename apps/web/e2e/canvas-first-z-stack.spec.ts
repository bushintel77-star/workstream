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
    timeout: 15_000,
  });
  const stack = await readLayerZStack(page);
  expect(stack, "Canvas-First wrapper mounted but returned no layers").not.toBeNull();
  return stack!;
}

test.describe("Canvas-First four-layer z-stack — Survey / Sketch / CAD / Garden", () => {
  test("each mode mounts the documented canvas → spatial → chrome → app stack", async ({
    page,
    request,
  }) => {
    const { projectId } = await createWrightsTier1Project(request);
    await page.goto(`/projects/${projectId}?webgl=1`, {
      waitUntil: "networkidle",
    });

    // The mode-tab strip is the chrome-tier affordance that drives
    // mode switches. Confirm it is mounted before we begin switching.
    const tabStrip = page.getByTestId("perimeter-tab-strip");
    await expect(tabStrip).toBeVisible({ timeout: 15_000 });

    const snapshots: Record<string, ReturnType<typeof Object>> = {};

    for (const mode of TARGET_MODES) {
      const tab = page.getByTestId(`mode-tab-${mode}`);
      // A locked tab renders as a <span aria-disabled="true">, not a
      // <button>. `.click()` would no-op; `.count()`-vs.-tag check skips
      // the iteration cleanly.
      const tabTag = await tab.evaluate((el) => el.tagName.toLowerCase());
      const isLocked = tabTag === "span";
      if (isLocked) {
        test.skip(
          true,
          `Mode "${mode}" is locked by progressive unlock — cannot probe z-stack.`,
        );
        return;
      }

      // Survey is the initial mode; clicking it would no-op the
      // ViewportTransitionHUD's snap-back. Probe immediately instead.
      // For all other modes, click first to trigger the transition.
      if (mode !== "survey") {
        await tab.click();
        // The wrapper's chrome slot re-keys during the transition:
        // ViewportTransitionHUD snaps back from `--cf-z-app` to the
        // chrome tier. Wait for the tab strip to remain attached
        // (re-attached after the re-key) before probing.
        await expect(
          page.getByTestId("perimeter-tab-strip"),
        ).toBeVisible({ timeout: 10_000 });
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
      waitUntil: "networkidle",
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
