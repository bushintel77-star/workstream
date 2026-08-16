import type { Page } from "@playwright/test";

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

export async function contrastFailures(page: Page): Promise<ContrastFailure[]> {
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
      if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity < 0.15) {
        continue;
      }
      const rect = el.getBoundingClientRect();
      if (
        rect.width < 2 ||
        rect.height < 2 ||
        rect.bottom < 0 ||
        rect.top > window.innerHeight
      ) {
        continue;
      }
      const bg = effBg(el);
      const fg = over(parse(cs.color), bg);
      const size = parseFloat(cs.fontSize);
      const weight = cs.fontWeight;
      const need = size >= 24 || (size >= 18.66 && +weight >= 700) ? 3 : 4.5;
      const measured = ratio(fg, bg);
      if (measured >= need) continue;
      const cls = (el.className?.toString?.() ?? "").slice(0, 60);
      const key = `${cls}|${size}|${Math.round(measured * 10)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        text: owned.map((n) => (n.textContent ?? "").trim()).join(" ").slice(0, 40),
        cls,
        size,
        weight,
        ratio: Math.round(measured * 100) / 100,
        need,
        fg: hex(fg),
        bg: hex(bg),
      });
    }
    return out.sort((a, b) => a.ratio - b.ratio);
  });
}
