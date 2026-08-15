import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  createWrightsTier1Project,
  handoffStudio,
  seedElevationGarden,
} from "./helpers";

/**
 * WCAG 2.2 AA text contrast gate for the operator canvas.
 *
 * Every mode is walked and every rendered text node is measured against its
 * *composited* background (chrome is layered translucent glass, so the parent
 * chain has to be flattened before the ratio means anything).
 *
 * This started as a one-off audit that found 23 failures across 22 rules — the
 * Tier-1 ledger heading was rendering dark-shell ink on white paper at 1.21:1,
 * and `--text-muted` (#9aa0ac) sat at 2.63:1 everywhere it labelled chrome.
 * Keep it green: the failure message names the class and the exact ratio.
 *
 * Gotcha for future edits: `color-mix()` computes to CSS Color 4
 * `color(srgb r g b / a)` whose channels are 0-1 floats, not 0-255. The parser
 * below scales them; drop that and every mixed surface silently reads as black.
 */

type Rgba = [number, number, number, number];

export type ContrastFailure = {
  text: string;
  cls: string;
  size: number;
  weight: string;
  ratio: number;
  need: number;
  fg: string;
  bg: string;
};

async function contrastFailures(page: Page): Promise<ContrastFailure[]> {
  return page.evaluate(() => {
    const parse = (c: string): Rgba => {
      const m = c.match(/[\d.]+/g);
      if (!m) return [0, 0, 0, 0];
      const k = /^color\(\s*srgb/i.test(c) ? 255 : 1;
      return [+m[0] * k, +m[1] * k, +m[2] * k, m[3] === undefined ? 1 : +m[3]];
    };
    const over = (fg: Rgba, bg: Rgba): Rgba => {
      const a = fg[3];
      return [
        fg[0] * a + bg[0] * (1 - a),
        fg[1] * a + bg[1] * (1 - a),
        fg[2] * a + bg[2] * (1 - a),
        1,
      ];
    };
    const lum = (c: Rgba) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    };
    const ratio = (a: Rgba, b: Rgba) => {
      const l1 = lum(a);
      const l2 = lum(b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };
    /** Flatten the ancestor chain down to the first opaque background. */
    const effBg = (el: Element): Rgba => {
      let cur: Element | null = el;
      const chain: Rgba[] = [];
      while (cur) {
        const bg = parse(getComputedStyle(cur).backgroundColor);
        if (bg[3] > 0) chain.push(bg);
        if (bg[3] >= 1) break;
        cur = cur.parentElement;
      }
      let acc: Rgba = [255, 255, 255, 1];
      for (let i = chain.length - 1; i >= 0; i -= 1) acc = over(chain[i], acc);
      return acc;
    };
    const hex = (c: Rgba) =>
      `#${[c[0], c[1], c[2]]
        .map((v) => Math.round(v).toString(16).padStart(2, "0"))
        .join("")}`;

    const out: ContrastFailure[] = [];
    const seen = new Set<string>();

    for (const el of Array.from(document.querySelectorAll("*"))) {
      const owned = Array.from(el.childNodes).filter(
        (n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 1,
      );
      if (!owned.length) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      // Mid-transition / deliberately ghosted chrome is not a contrast claim.
      if (+cs.opacity < 0.15) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (r.bottom < 0 || r.top > window.innerHeight) continue;

      const bg = effBg(el);
      const fg = over(parse(cs.color), bg);
      const size = parseFloat(cs.fontSize);
      const weight = cs.fontWeight;
      const large = size >= 24 || (size >= 18.66 && +weight >= 700);
      const need = large ? 3 : 4.5;
      const cr = ratio(fg, bg);
      if (cr >= need) continue;

      const cls = (el.className?.toString?.() ?? "").slice(0, 60);
      const key = `${cls}|${size}|${Math.round(cr * 10)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        text: owned
          .map((n) => (n.textContent ?? "").trim())
          .join(" ")
          .slice(0, 40),
        cls,
        size,
        weight,
        ratio: Math.round(cr * 100) / 100,
        need,
        fg: hex(fg),
        bg: hex(bg),
      });
    }
    return out.sort((a, b) => a.ratio - b.ratio);
  });
}

const MODES = ["survey", "sketch", "cad", "elevation", "quote"] as const;

test.describe("Canvas text contrast (WCAG 2.2 AA)", () => {
  test("every studio mode keeps all text at or above AA", async ({
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
      // The classic surfaces carry the dense text — audit them explicitly
      // (the default WebGL mount owns sketch/quote natively).
      await page.goto(`/projects/${projectId}?svg=1&mode=${mode}`);
      await expect(handoffStudio(page)).toBeVisible({ timeout: 30_000 });
      // Let coaching cards / lanes finish their enter animation before reading
      // computed colour, or a mid-fade opacity is measured as a failure.
      await page.waitForTimeout(2500);

      for (const f of await contrastFailures(page)) {
        report.push(
          `${mode}: ${f.ratio}:1 (needs ${f.need}) ${f.size}px w${f.weight} ` +
            `${f.fg} on ${f.bg} — "${f.text}" [${f.cls}]`,
        );
      }
    }

    expect(report, `WCAG AA text contrast failures:\n${report.join("\n")}`).toEqual(
      [],
    );
  });
});
