import { expect, test, type Page } from "@playwright/test";

import { createWrightsTier1Project } from "./helpers";

/**
 * Pairwise chrome collision gate — floating instruments measured against each
 * other, at three viewports across four modes.
 *
 * ## Why this file was written from scratch on 2026-09-04
 *
 * It did not exist. The design docs that mandated it (the purged 2026 design
 * spec set — see git history, commit 9e02e07's doc purge) recorded it as a
 * passed gate with a 12.1m run, `.cursor/rules/end-of-build.mdc` lists it as
 * a required gate, and `webgl-chrome-coverage.spec.ts` defines its own scope
 * by contrast with it ("this measures everything that paints over the
 * drawing; collision measures floating instruments against each other").
 *
 * Nothing enforced any of it. The consequence shipped: three of the five
 * bottom-centre instruments overlapped at the default viewport —
 *
 *   - the viewpoint filmstrip (bottom 96px, h 42) sat ENTIRELY inside the
 *     history scrub (bottom 88px, h 62) — 480x42px of collision;
 *   - the history scrub's lower edge dipped 8px into the camera dock
 *     (bottom 22px, h 74);
 *   - the SEL and VIEW toggles covered the dock's PLAN button, because their
 *     fixed `translateX(-50% - 140px/-200px)` centre offsets stopped clearing
 *     the dock's half-width once it reached 548px.
 *
 * Every one of those elements sat correctly at `--cf-z-chrome`, so
 * `canvas-first-z-stack.spec.ts` — which asserts the four-slot z ladder — saw
 * nothing wrong. The collision was geometric, *inside* one slot, which is
 * precisely the gap this spec is supposed to cover.
 *
 * ## What counts as a collision
 *
 * Any two instruments whose rects intersect by more than `TOLERANCE_PX`,
 * except:
 *   - ancestor/descendant pairs — a container holding its own children is
 *     composition, not collision (`el.contains(other)` filters these);
 *   - anything hidden, transparent, or zero-area at measure time.
 *
 * Each instrument must also be fully on-screen: an instrument pushed off the
 * viewport does not overlap anything, and that is not a pass.
 */

/**
 * The floating instruments, by the testid each already publishes. Containers
 * are deliberately included (`bottom-chrome-stack`): the ancestor filter
 * excludes them from their own children, and their presence catches an
 * instrument that escapes its stack and lands on an unrelated one.
 * (`coord-chip` was removed 2026-09-04 — the fixed bottom-left coordinate
 * chip was replaced by the cursor-adjacent live-nib-readout, which is only
 * visible mid-stroke and is excluded by the opacity filter by design.)
 */
const INSTRUMENTS = [
  "bottom-chrome-stack",
  "camera-dock",
  "history-scrub",
  "viewpoint-filmstrip",
  "draw-view-toggle",
  "selection-mode-toggle",
  "tool-ribbon",
  "depth-rail",
  "scale-toggle",
] as const;

/** The three canonical viewports the design system was composed against. */
const VIEWPORTS = [
  { width: 2560, height: 1080 },
  { width: 1280, height: 720 },
  { width: 960, height: 640 },
] as const;

/** The four operator-facing modes this gate sweeps. */
const MODES = ["survey", "sketch", "cad", "quote"] as const;

/**
 * Sub-pixel rounding and the 1px glass borders make exact-zero intersection
 * the wrong bar. Two instruments sharing an edge are adjacent, not colliding;
 * 2px of mutual cover is a layout bug.
 */
const TOLERANCE_PX = 2;

interface Rect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Probe {
  rects: Rect[];
  /** `${a}|${b}` for every ancestor/descendant pair, so overlap is excused. */
  nested: string[];
  offscreen: { id: string; detail: string }[];
}

async function probeChrome(page: Page, ids: readonly string[]): Promise<Probe> {
  return page.evaluate((testIds: string[]) => {
    const found: { id: string; el: Element; r: DOMRect }[] = [];

    for (const id of testIds) {
      // An instrument may legitimately be absent in a given mode (the
      // filmstrip is Sketch-only, the depth rail is every mode but Sketch).
      // Absence is not a failure; a present-but-colliding one is.
      document.querySelectorAll(`[data-testid="${id}"]`).forEach((el, i) => {
        const st = getComputedStyle(el);
        if (st.visibility === "hidden" || st.display === "none") return;
        if (Number(st.opacity) <= 0.05) return;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return;
        found.push({ id: i === 0 ? id : `${id}#${i}`, el, r });
      });
    }

    const nested: string[] = [];
    for (let i = 0; i < found.length; i++) {
      for (let j = i + 1; j < found.length; j++) {
        const a = found[i]!;
        const b = found[j]!;
        if (a.el.contains(b.el) || b.el.contains(a.el)) {
          nested.push(`${a.id}|${b.id}`);
        }
      }
    }

    const offscreen: { id: string; detail: string }[] = [];
    for (const f of found) {
      const { r } = f;
      const over: string[] = [];
      if (r.left < -1) over.push(`left ${Math.round(r.left)}`);
      if (r.top < -1) over.push(`top ${Math.round(r.top)}`);
      if (r.right > window.innerWidth + 1) {
        over.push(`right ${Math.round(r.right)} > ${window.innerWidth}`);
      }
      if (r.bottom > window.innerHeight + 1) {
        over.push(`bottom ${Math.round(r.bottom)} > ${window.innerHeight}`);
      }
      if (over.length) offscreen.push({ id: f.id, detail: over.join(", ") });
    }

    return {
      rects: found.map((f) => ({
        id: f.id,
        x: Math.round(f.r.left),
        y: Math.round(f.r.top),
        w: Math.round(f.r.width),
        h: Math.round(f.r.height),
      })),
      nested,
      offscreen,
    };
  }, ids as unknown as string[]);
}

/** Every colliding pair, with the intersection stated so the failure is actionable. */
function collisions(probe: Probe): string[] {
  const excused = new Set(probe.nested);
  const out: string[] = [];
  for (let i = 0; i < probe.rects.length; i++) {
    for (let j = i + 1; j < probe.rects.length; j++) {
      const a = probe.rects[i]!;
      const b = probe.rects[j]!;
      if (excused.has(`${a.id}|${b.id}`) || excused.has(`${b.id}|${a.id}`)) {
        continue;
      }
      const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ix > TOLERANCE_PX && iy > TOLERANCE_PX) {
        out.push(
          `${a.id} [${a.x},${a.y} ${a.w}x${a.h}] overlaps ` +
            `${b.id} [${b.x},${b.y} ${b.w}x${b.h}] by ${Math.round(ix)}x${Math.round(iy)}px`,
        );
      }
    }
  }
  return out;
}

test.describe("WebGL floating chrome — pairwise collision", () => {
  /**
   * Twelve studio loads (3 viewports x 4 modes), each a WebGL mount with a
   * camera settle. Measured at ~30s per load on the reference dev box, which
   * is the same budget `canvas-first-z-stack.spec.ts` documents for the same
   * work. The design spec's own gate table records a 12.1m run for this file.
   */
  test.setTimeout(process.env.CI ? 900_000 : 600_000);

  test("no two floating instruments overlap, at 3 viewports x 4 modes", async ({
    page,
    request,
  }) => {
    const { projectId } = await createWrightsTier1Project(request);

    // The first-run controls hint widens the guidance chip and is transient —
    // dismissed up front, the same way webgl-chrome-coverage.spec.ts seeds it,
    // so the gate measures the steady state rather than its own fixture.
    await page.addInitScript(() => {
      window.sessionStorage.setItem("gs-controls-hint-seen", "1");
    });

    const failures: string[] = [];
    const report: string[] = [];

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const mode of MODES) {
        await page.goto(`/projects/${projectId}?mode=${mode}`, {
          waitUntil: "networkidle",
        });
        await expect(page.locator('[data-testid="webgl-studio"]')).toBeVisible({
          timeout: 30_000,
        });
        // Let the camera spring settle so instruments are measured at rest
        // rather than mid-transition.
        await page.waitForTimeout(4_000);

        const label = `${vp.width}x${vp.height} ${mode}`;
        const probe = await probeChrome(page, INSTRUMENTS);
        const hits = collisions(probe);

        report.push(
          `${label}: ${probe.rects.length} instruments, ` +
            `${hits.length} collisions, ${probe.offscreen.length} offscreen`,
        );

        for (const hit of hits) failures.push(`${label} — ${hit}`);
        for (const off of probe.offscreen) {
          failures.push(
            `${label} — ${off.id} is pushed outside the viewport (${off.detail}); ` +
              `an instrument that has left the screen collides with nothing, ` +
              `and that is not a pass`,
          );
        }
      }
    }

    console.log(`CHROME COLLISION REPORT\n  ${report.join("\n  ")}`);

    expect(
      failures,
      `Floating chrome collided. Each instrument owns its own box — the ` +
        `bottom-centre panels are flow children of \`.bottomStack\` ` +
        `(FloatingChrome.module.css) precisely so a panel that grows pushes ` +
        `its neighbours instead of painting over them. A hand-written ` +
        `\`bottom\`/\`translateX\` offset on any of them is how this last ` +
        `broke.\n\n  ${failures.join("\n  ")}`,
    ).toEqual([]);
  });
});
