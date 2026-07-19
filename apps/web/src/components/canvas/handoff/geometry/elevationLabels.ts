/**
 * Elevation label layout — Workflow 1 SVG viewBox space.
 *
 * Places height callouts with bbox collision, edge clamp, and optional
 * leader lines so labels never pile on each other or clip the board.
 */

export type ElevLabelAnchor = {
  id: string;
  /** Horizontal anchor (viewBox x). */
  x: number;
};

export type ElevLabelInput = {
  id: string;
  /** Bar centre x (viewBox). */
  barX: number;
  /** Top of the profile bar (viewBox y). */
  barTopY: number;
  /** Display string (already shortened). */
  text: string;
};

export type ElevLabelPlacement = {
  id: string;
  text: string;
  /** Text anchor (middle of mask). */
  x: number;
  /** Text baseline y. */
  y: number;
  maskW: number;
  maskH: number;
  /** Leader from label bottom-centre toward the bar top. */
  leader: { x1: number; y1: number; x2: number; y2: number } | null;
};

const VIEW_W = 100;
const VIEW_H = 40;
const PAD = 1.2;
const MASK_H = 2.7;
const STACK_STEP = 3.0;
const CHAR_W = 1.05;
const MAX_MASK_W = 24;

/** Short elevation callouts — full names live in plan / BOM. */
export function shortenElevationTag(tag: string): string {
  const t = tag.trim();
  if (/^existing/i.test(t)) return "Existing";
  if (/^canopy/i.test(t)) return "Canopy";
  if (/^feature/i.test(t)) return "Feature";
  if (/^plant\s*bed/i.test(t)) return "Bed";
  if (/^french\s*drain/i.test(t)) return "Drain";
  if (/^bluestone/i.test(t)) return "Paving";
  // Strip DBH / trailing detail before the height join
  const head = t.split("·")[0]?.trim() ?? t;
  return head.length > 14 ? `${head.slice(0, 12)}…` : head;
}

export function elevationLabelText(tag: string, heightM: number): string {
  return `${shortenElevationTag(tag)} · ${heightM.toFixed(1)} m`;
}

function estimateMaskW(text: string): number {
  return Math.min(MAX_MASK_W, Math.max(8, 4.5 + text.length * CHAR_W));
}

function boxesOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
  gap = 0.45,
): boolean {
  return !(
    a.x + a.w + gap <= b.x ||
    b.x + b.w + gap <= a.x ||
    a.y + a.h + gap <= b.y ||
    b.y + b.h + gap <= a.y
  );
}

/**
 * Assign stack indices (0 = baseline). Kept for callers that only need
 * a simple left→right fan; prefer `layoutElevationLabels` for full boards.
 */
export function assignElevationLabelStacks(
  anchors: ElevLabelAnchor[],
  collisionThresh = 12,
): Map<string, number> {
  const sorted = [...anchors].sort((a, b) => a.x - b.x || a.id.localeCompare(b.id));
  const stacks = new Map<string, number>();
  let prevX = -Infinity;
  let prevStack = 0;
  for (const a of sorted) {
    const stack =
      Number.isFinite(prevX) && a.x - prevX < collisionThresh
        ? prevStack + 1
        : 0;
    stacks.set(a.id, stack);
    prevX = a.x;
    prevStack = stack;
  }
  return stacks;
}

/** Vertical offset in viewBox units for a stack index. */
export function elevationLabelOffsetY(stack: number, step = STACK_STEP): number {
  return Math.max(0, stack) * step;
}

/**
 * Full 2D label layout: stack upward on collision, then nudge sideways,
 * clamp into the viewBox, and draw a leader when the label leaves the bar.
 */
export function layoutElevationLabels(
  inputs: ElevLabelInput[],
  opts?: { viewW?: number; viewH?: number; pad?: number },
): ElevLabelPlacement[] {
  const viewW = opts?.viewW ?? VIEW_W;
  const viewH = opts?.viewH ?? VIEW_H;
  const pad = opts?.pad ?? PAD;
  const sorted = [...inputs].sort(
    (a, b) => a.barX - b.barX || a.id.localeCompare(b.id),
  );
  const placed: ElevLabelPlacement[] = [];
  const boxes: Array<{ x: number; y: number; w: number; h: number }> = [];

  for (const input of sorted) {
    const maskW = estimateMaskW(input.text);
    const preferredBaseline = input.barTopY - 1.0;
    let best: ElevLabelPlacement | null = null;

    // Try upward stacks, then left/right nudges
    const xNudges = [0, -maskW * 0.35, maskW * 0.35, -maskW * 0.65, maskW * 0.65];
    outer: for (const dx of xNudges) {
      for (let stack = 0; stack < 8; stack += 1) {
        let cx = input.barX + dx;
        let baseline = preferredBaseline - stack * STACK_STEP;
        // Clamp so mask stays inside the board
        const half = maskW / 2;
        cx = Math.max(pad + half, Math.min(viewW - pad - half, cx));
        const top = baseline - 2.15;
        if (top < pad) {
          baseline = pad + 2.15;
        }
        if (baseline > viewH - pad) {
          baseline = viewH - pad;
        }
        const box = {
          x: cx - half,
          y: baseline - 2.15,
          w: maskW,
          h: MASK_H,
        };
        if (boxes.some((b) => boxesOverlap(box, b))) continue;

        const dy = Math.abs(cx - input.barX) > 1.2 || stack > 0;
        best = {
          id: input.id,
          text: input.text,
          x: cx,
          y: baseline,
          maskW,
          maskH: MASK_H,
          leader: dy
            ? {
                x1: cx,
                y1: box.y + box.h,
                x2: input.barX,
                y2: input.barTopY,
              }
            : null,
        };
        break outer;
      }
    }

    // Fallback: force-clamp even if still tight
    if (!best) {
      const cx = Math.max(
        pad + maskW / 2,
        Math.min(viewW - pad - maskW / 2, input.barX),
      );
      const baseline = Math.max(pad + 2.15, preferredBaseline - 6);
      best = {
        id: input.id,
        text: input.text,
        x: cx,
        y: baseline,
        maskW,
        maskH: MASK_H,
        leader: {
          x1: cx,
          y1: baseline - 2.15 + MASK_H,
          x2: input.barX,
          y2: input.barTopY,
        },
      };
    }

    placed.push(best);
    boxes.push({
      x: best.x - best.maskW / 2,
      y: best.y - 2.15,
      w: best.maskW,
      h: best.maskH,
    });
  }

  return placed;
}
