import { test, expect, type ConsoleMessage, type Page } from "@playwright/test";
import { createAddressProject } from "./helpers";
import { randomUUID } from "node:crypto";

/** Prefer 127.0.0.1 — `localhost` can resolve to ::1 while the API binds IPv4. */
const API = process.env.API_URL ?? "http://127.0.0.1:3001";

/**
 * Chrome collision spec — geometric proof that the floating chrome never
 * overlaps itself and never leaves the viewport.
 *
 * For each state (idle / maximum instruments / assets dock open) and at a
 * desktop + a tight viewport, every chrome surface's bounding rect is
 * collected ([data-gs-glass-card], the asset dock, the tool rail) and
 * asserted pairwise non-intersecting (2px tolerance) and fully on-screen.
 *
 * The maximum-instruments state seeds terrain (Section/Flow gate in),
 * an extruded pad (Earth gates in), placements (Quote gates in) and a
 * boundary (Dims gate in) — every card mounted at once.
 */

interface Rect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** True when the card sits in a scrollable column (overflow clips it by
   *  design; vertical viewport escape is then legal, horizontal is not). */
  inScroller: boolean;
  /** Stable index within the collected set (survives the clipped filter). */
  idx: number;
  /**
   * Indices of collected surfaces that DOM-contain this one. A nested surface
   * (the save chip inside the tab strip, the survey panel inside the perimeter
   * panel) always "overlaps" its parent — that is containment, not collision.
   */
  ancestors: number[];
}

/**
 * Every floating chrome surface, not a hand-maintained selector list.
 *
 * The original three-selector list (`[data-gs-glass-card]`, the asset dock and
 * the tool rail) could not see the nib palette, the projection capsule, the
 * controls hint or the guidance line — so a 89x47px overlap between the nib
 * palette and the projection HUD at 960px shipped green. Anything that opts
 * into pointer events and carries a testid inside the chrome overlay is chrome,
 * and is measured.
 *
 * Widened 2026-08-22: this list did not match the estimation companion at all,
 * so a 320x600 fit-sheet card covering the survey checklist by 316x214px
 * shipped green. `FitSheetCard` now stamps `data-gs-glass-card` on both of its
 * surfaces — the catch-all selector existed for exactly this and the card never
 * opted in.
 *
 * Deliberately NOT here: the Vicmap meta chips (`meta-chip-*`) and the
 * dimension labels (`dim-label`). Those are world-anchored annotations — part
 * of the drawing, rendered as DOM for crisp text — not floating instruments,
 * and floating chrome is *supposed* to be able to sit over the drawing. They
 * are measured by `webgl-chrome-coverage.spec.ts`, whose numerator is
 * deliberately broader than this pairwise set, because what matters for them is
 * how much of the drawing they cover, not whether they touch a card.
 */
const CHROME_SELECTOR = [
  "[data-gs-glass-card]",
  "[data-testid='asset-dock']",
  "[data-testid='studio-tool-rail']",
  "[data-testid='nib-palette']",
  "[data-testid='viewport-transition-hud']",
  "[data-testid='interaction-guidance']",
  "[data-testid='workflow-guide']",
  "[data-testid='selection-chip']",
  "[data-testid='survey-locate-state']",
  "[data-testid='perimeter-tab-strip']",
  "[data-testid='project-identity']",
].join(", ");

async function chromeRects(page: Page, selector = CHROME_SELECTOR): Promise<Rect[]> {
  return page.evaluate((sel: string) => {
    const list = Array.from(document.querySelectorAll<HTMLElement>(sel));
    return list
      .map((el, i) => {
        const r = el.getBoundingClientRect();
        let inScroller = false;
        let clipped = false;
        for (
          let a = el.parentElement;
          a && a instanceof HTMLElement;
          a = a.parentElement
        ) {
          const oy = getComputedStyle(a).overflowY;
          if (
            (oy === "auto" || oy === "scroll") &&
            a.scrollHeight > a.clientHeight
          ) {
            inScroller = true;
            // The scroller's own rect is the visible surface; a clipped
            // descendant's full layout rect extends past it invisibly.
            if (a !== el && a.scrollHeight - a.clientHeight > 2) clipped = true;
            break;
          }
        }
        const ancestors: number[] = [];
        list.forEach((other, j) => {
          if (other !== el && other.contains(el)) ancestors.push(j);
        });
        return {
          id:
            el.getAttribute("data-testid") ??
            el.querySelector("[data-testid]")?.getAttribute("data-testid") ??
            `glass-card-${i}`,
          x: r.x,
          y: r.y,
          w: r.width,
          h: r.height,
          inScroller,
          clipped,
          idx: i,
          ancestors,
        };
      })
      // Zero-size surfaces are unmounted-but-present wrappers, not chrome.
      .filter((r) => !r.clipped && r.w > 0 && r.h > 0) as Rect[];
  }, selector);
}

const TOL = 2; // px — sub-pixel + shadow tolerance

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w - TOL &&
    b.x < a.x + a.w - TOL &&
    a.y < b.y + b.h - TOL &&
    b.y < a.y + a.h - TOL
  );
}

/**
 * Every violation in the state, not the first one. A per-pair `expect` aborts
 * on the first hit and hides the rest — the widened selector found a dim label
 * under the guidance line and stopped before it reached the fit sheet, which is
 * the same "one failure masks the others" trap the gate is meant to remove.
 */
function expectNoCollisions(rects: Rect[], vw: number, vh: number, label: string) {
  const violations: string[] = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i]!;
      const b = rects[j]!;
      // Nesting is not collision: a docked surface legitimately sits inside
      // its host panel, and the save chip sits inside the tab strip.
      if (a.ancestors.includes(b.idx) || b.ancestors.includes(a.idx)) continue;
      // Cards inside a scrollable column may be clipped below the fold —
      // their layout rects can extend off-screen; overlap with visible chrome
      // is still checked only where both rects are actually visible.
      if (a.inScroller && b.y >= vh) continue;
      if (b.inScroller && a.y >= vh) continue;
      if (overlaps(a, b)) {
        violations.push(
          `overlap: ${a.id} (${Math.round(a.x)},${Math.round(a.y)} ${Math.round(a.w)}x${Math.round(a.h)}) × ${b.id} (${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.w)}x${Math.round(b.h)})`,
        );
      }
    }
  }
  for (const r of rects) {
    const horizontalOk = r.x >= 0 && r.x + r.w <= vw;
    const verticalOk = r.inScroller || (r.y >= 0 && r.y + r.h <= vh);
    if (!horizontalOk || !verticalOk) {
      violations.push(
        `escape: ${r.id} (x ${Math.round(r.x)}, y ${Math.round(r.y)}, ${Math.round(r.w)}x${Math.round(r.h)})`,
      );
    }
  }
  // Soft: report every failing matrix cell in one run rather than aborting on
  // the first, so a widened selector cannot hide the next defect behind the
  // one it just found.
  expect
    .soft(
      violations,
      `${label} — ${violations.length} chrome violation(s):\n  ${violations.join("\n  ")}`,
    )
    .toEqual([]);
}

/**
 * The named invariant from `FitSheetCard.tsx`'s own docstring: "chrome tier …
 * Never above a mode panel." A written contract deserves a direct assertion,
 * not incidental pairwise coverage — the pairwise sweep could not see the fit
 * sheet at all until it stamped `data-gs-glass-card`.
 */
async function expectFitSheetClearOfModePanel(page: Page, label: string) {
  const hit = await page.evaluate(() => {
    const panel = document
      .querySelector('[data-testid="perimeter-panel"]')
      ?.getBoundingClientRect();
    if (!panel) return null;
    for (const sel of [
      '[data-testid="fit-sheet-card"]',
      '[data-testid="fit-sheet-pill"]',
    ]) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const ox = Math.min(panel.right, r.right) - Math.max(panel.left, r.left);
      const oy = Math.min(panel.bottom, r.bottom) - Math.max(panel.top, r.top);
      if (ox > 2 && oy > 2) {
        return {
          sel,
          ox: Math.round(ox),
          oy: Math.round(oy),
          fit: `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`,
          panel: `${Math.round(panel.x)},${Math.round(panel.y)} ${Math.round(panel.width)}x${Math.round(panel.height)}`,
        };
      }
    }
    return null;
  });
  expect
    .soft(
      hit,
      `${label}: the estimation companion overlaps the mode panel by ${hit?.ox}x${hit?.oy}px (${hit?.sel} at ${hit?.fit}, perimeter-panel at ${hit?.panel}). FitSheetCard.tsx: "Never above a mode panel."`,
    )
    .toBeNull();
}

/** Mode tabs carry no programmatic pressed state, so the guidance line — which
 *  is derived straight from `activeMode` — is the mode's DOM witness. */
const MODE_WITNESS: Record<string, string> = {
  survey: "Survey mode",
  sketch: "Sketch mode",
  cad: "CAD mode",
  quote: "Quote mode",
};

async function expectResolvedMode(page: Page, mode: string) {
  // `resolveCanvasMode` silently falls back to `suggestedMode(progress)` for a
  // locked mode, so a `?mode=` navigation is NOT proof the studio entered it.
  // The original spec navigated with no `?mode=` at all and landed in quote,
  // where no perimeter-panel mounts and there was nothing to collide with.
  await expect(
    page.getByTestId("interaction-guidance"),
    `?mode=${mode} did not resolve to ${mode} — progressive unlock rerouted it`,
  ).toContainText(MODE_WITNESS[mode]!, { timeout: 15_000 });
}

/** Seed the maximum-chrome project: terrain + pad + placements + boundary. */
async function seedMaximumProject(
  request: import("@playwright/test").APIRequestContext,
  address: string,
) {
  const { projectId } = await createAddressProject(request, {
    address,
  });
  const place = (symbol_id: string, x_pct: number, y_pct: number) => ({
    id: randomUUID(),
    symbol_id,
    x_pct,
    y_pct,
    rotation_deg: 0,
    scale: 1,
  });
  const seed = await request.put(
    `${API}/projects/${projectId}/design-canvas`,
    {
      data: {
        placements: [place("olive-standard", 40, 45), place("bluestone-paver", 60, 55)],
        strokes: [
          {
            id: randomUUID(),
            points: [
              { x_pct: 30, y_pct: 30 },
              { x_pct: 50, y_pct: 30 },
              { x_pct: 50, y_pct: 50 },
              { x_pct: 30, y_pct: 50 },
              { x_pct: 30, y_pct: 30 },
            ],
            color: "#ff2ef6",
            width_px: 2.5,
            kind: "ink" as const,
            extrude_height_m: 1.2,
          },
        ],
        irrigation_zones: [],
        site_frame: {
          boundary: [
            { x_pct: 15, y_pct: 10 },
            { x_pct: 85, y_pct: 10 },
            { x_pct: 85, y_pct: 90 },
            { x_pct: 15, y_pct: 90 },
          ],
          building: [
            { x_pct: 35, y_pct: 18 },
            { x_pct: 65, y_pct: 18 },
            { x_pct: 65, y_pct: 32 },
            { x_pct: 35, y_pct: 32 },
          ],
          building_source: "traced",
          easements: [],
          services: [],
          levels: [
            { x_pct: 25, y_pct: 25, z_m: 50.0, source: "authored" as const },
            { x_pct: 75, y_pct: 25, z_m: 49.8, source: "authored" as const },
            { x_pct: 25, y_pct: 75, z_m: 51.2, source: "authored" as const },
            { x_pct: 75, y_pct: 75, z_m: 51.0, source: "authored" as const },
          ],
        },
      },
    },
  );
  expect(seed.ok()).toBeTruthy();
  return projectId;
}

test.describe("WebGL chrome collision", () => {
  // Four states × three viewports, including two full split-view canvas
  // mounts — exceeds the default budget on cold hardware.
  test.setTimeout(420_000);
  test("no chrome overlaps across states and viewports", async ({
    page,
    request,
  }) => {
    const errors: string[] = [];
    page.on("console", (m: ConsoleMessage) => {
      if (m.type() === "error") errors.push(m.text().slice(0, 300));
    });
    page.on("pageerror", (e) => errors.push(`${e.name}: ${e.message.slice(0, 300)}`));

    const projectId = await seedMaximumProject(
      request,
      "1 Collision Test Street, Melbourne VIC 3000",
    );

    for (const [vw, vh] of [
      [2560, 1080],
      [1280, 720],
      [960, 640],
    ]) {
      await page.setViewportSize({ width: vw, height: vh });
      // Explicit mode: survey is Step 0, the mode the operator actually opens
      // a new site in, and the one that mounts the tallest perimeter-panel.
      await page.goto(`/projects/${projectId}?webgl=1&mode=survey`, {
        waitUntil: "networkidle",
      });
      await page.waitForTimeout(4000);
      await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
        timeout: 10_000,
      });
      await expectResolvedMode(page, "survey");

      // State 1: idle (default-on instruments: dims + earthworks + quote).
      expectNoCollisions(await chromeRects(page), vw, vh, `idle ${vw}x${vh}`);
      await expectFitSheetClearOfModePanel(page, `idle ${vw}x${vh}`);

      // State 2: maximum — every instrument toggled on.
      for (const tool of ["Section", "Flow", "Underground"]) {
        const name = new RegExp(`^▸ ${tool}$`);
        const btn = page.getByRole("button", { name });
        if (await btn.count()) await btn.click();
      }
      await page.waitForTimeout(600);
      expectNoCollisions(await chromeRects(page), vw, vh, `max ${vw}x${vh}`);

      // State 3: assets dock open on top of everything.
      await page.getByRole("button", { name: "▸ Assets" }).click();
      await page.waitForTimeout(600);
      expectNoCollisions(await chromeRects(page), vw, vh, `assets ${vw}x${vh}`);
      await page.getByRole("button", { name: "▾ Assets" }).click();

      // State 4: split view — chrome wraps TWO viewports; the per-half
      // label chips (25%/75% width) are the new chrome elements.
      await page.getByRole("button", { name: "▸ Split" }).click();
      await page.waitForTimeout(1200);
      const splitRects = await chromeRects(
        page,
        `${CHROME_SELECTOR}, [data-testid='split-label-plan'], [data-testid='split-label-sketch']`,
      );
      expectNoCollisions(splitRects, vw, vh, `split ${vw}x${vh}`);
      await page.getByTestId("rail-split").evaluate((button: HTMLButtonElement) => {
        button.click();
      });
    }

    const fatal = errors.filter(
      (e) =>
        e.includes("Maximum update depth") ||
        e.includes("TypeError") ||
        e.includes("ReferenceError"),
    );
    expect(fatal, `Fatal console errors:\n${fatal.join("\n")}`).toHaveLength(0);
  });

  /**
   * Mode axis × persisted-preference axis.
   *
   * Two holes this closes. (1) The spec above navigated with no `?mode=`, so
   * `resolveCanvasMode(undefined, progress)` fell through to
   * `suggestedMode(progress)`; with the fixture's placements + strokes +
   * boundary that resolves to `quote`, and in quote-with-items the mode-body
   * IIFE reaches no branch — so no `perimeter-panel` mounted and there was
   * nothing for the fit sheet to collide with. (2) `FitSheetCapsule` reads its
   * expanded state from `localStorage["workstream.fitSheet.expanded"]`, so a
   * fresh Playwright context is ALWAYS collapsed while the operator's browser
   * remembered the 320x600 expanded card. Both shapes are walked here, with
   * the preference seeded before the app boots.
   *
   * The cell that reproduces the reported screen is survey + populated fit
   * sheet + expanded capsule, at the operator's 1600x950.
   */
  test("no chrome overlaps across modes and capsule shapes", async ({
    page,
    request,
  }) => {
    test.setTimeout(420_000);
    const errors: string[] = [];
    page.on("console", (m: ConsoleMessage) => {
      if (m.type() === "error") errors.push(m.text().slice(0, 300));
    });
    page.on("pageerror", (e) => errors.push(`${e.name}: ${e.message.slice(0, 300)}`));

    const projectId = await seedMaximumProject(
      request,
      "3 Mode Axis Street, Melbourne VIC 3000",
    );

    // Seed the operator's remembered preference: expanded on every load.
    await page.addInitScript(() => {
      window.localStorage.setItem("workstream.fitSheet.expanded", "1");
    });

    const vw = 1600;
    const vh = 950;
    await page.setViewportSize({ width: vw, height: vh });

    for (const mode of ["survey", "sketch", "cad", "quote"] as const) {
      await page.goto(`/projects/${projectId}?webgl=1&mode=${mode}`, {
        waitUntil: "networkidle",
      });
      await page.waitForTimeout(4000);
      await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
        timeout: 10_000,
      });
      await expectResolvedMode(page, mode);

      // Shape A: whatever the seeded preference produced on a cold load.
      const seeded = `${mode} seeded-expanded`;
      expectNoCollisions(await chromeRects(page), vw, vh, seeded);
      await expectFitSheetClearOfModePanel(page, seeded);

      // Shape B: the other capsule shape, reached through the real control.
      const collapse = page.getByRole("button", {
        name: "Collapse quotation back to summary pill",
      });
      const expand = page.getByTestId("fit-sheet-pill");
      if (await collapse.count()) await collapse.click();
      else if (await expand.count()) await expand.click();
      await page.waitForTimeout(600);
      const toggled = `${mode} toggled-capsule`;
      expectNoCollisions(await chromeRects(page), vw, vh, toggled);
      await expectFitSheetClearOfModePanel(page, toggled);
    }

    const fatal = errors.filter(
      (e) =>
        e.includes("Maximum update depth") ||
        e.includes("TypeError") ||
        e.includes("ReferenceError"),
    );
    expect(fatal, `Fatal console errors:\n${fatal.join("\n")}`).toHaveLength(0);
  });

  test("rail labels never wrap or widen their 42px pills", async ({
    page,
    request,
  }) => {
    // UI survey §1.2: rail labels overflow/clip for >8-char names. The pill
    // must stay 42px (non-touch) and each label must stay on ONE line —
    // mid-word wrap or a widened pill is a regression of the text contract.
    const { projectId } = await createAddressProject(request, {
      address: "2 Rail Test Street, Melbourne VIC 3000",
    });
    await page.goto(`/projects/${projectId}?webgl=1`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(3000);
    await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
      timeout: 10_000,
    });

    const violations = await page.evaluate(() => {
      const out: string[] = [];
      for (const b of Array.from(
        document.querySelectorAll<HTMLButtonElement>('[data-testid^="rail-"]'),
      )) {
        const r = b.getBoundingClientRect();
        if (r.width > 43) {
          out.push(`${b.getAttribute("data-testid")}: pill ${Math.round(r.width)}px`);
        }
        const label = b.querySelector("span:last-child");
        if (label instanceof HTMLElement && label.scrollHeight > label.clientHeight + 1) {
          out.push(
            `${b.getAttribute("data-testid")}: label wrapped (${label.scrollHeight} > ${label.clientHeight})`,
          );
        }
      }
      return out;
    });
    expect(
      violations,
      `Rail label contract violations:\n${violations.join("\n")}`,
    ).toHaveLength(0);
  });
});
