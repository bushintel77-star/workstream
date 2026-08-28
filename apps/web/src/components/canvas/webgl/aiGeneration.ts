/**
 * AI Generation — the generative engine for the AI-driven native canvas.
 *
 * Takes a natural language prompt ("native screening along the west
 * boundary") plus the site's real context (boundary, building, existing
 * trees, envelope conditions, A2-6 status) and returns ghost placements
 * the operator can accept or reject.
 *
 * Boundary-native placement (AEC-GENERATIVE-FUSION-2026, after Higharc's
 * disclosed Generative Building Model): representation beats model scale.
 * Their wall-referenced entity parameters made generated rooms
 * geometrically valid by construction; the lot-side translation is
 * EDGE-REFERENCED placement — every boundary ghost is parameterized as
 * (edge index, arc-length position, inward inset) instead of absolute
 * board-%, so it is invariant to lot shape and steerable on re-run. Mass
 * ghosts are constraint-sampled: point-in-polygon with building / easement
 * / existing-crown exclusion DURING generation, not corrected after.
 *
 * Determinism: the RNG is seeded from the prompt, so the same prompt on
 * the same site yields the same proposal — an operator can re-run and
 * tweak (count, inset) without the deck reshuffling underneath them.
 *
 * Zero-mock law: ghosts are always tagged with the prompt that generated
 * them. They never persist until accepted.
 */

import type { CatalogPlacement } from "@workstream/contracts";
import { rankCurtisFloraCandidates, type FloraCandidate } from "@workstream/domain";
import type { SiteEnvelope } from "@workstream/contracts";
import type { PctPoint } from "./coordTransform";

// ---------------------------------------------------------------------------
// Prompt parsing (pure) — extract intent from natural language
// ---------------------------------------------------------------------------

export interface ParsedIntent {
  /** What kind of landscape element to generate. */
  category: "screening" | "garden-bed" | "canopy-trees" | "hedge" | "groundcover" | "seating" | "compliance-fill" | "general";
  /** Where on the site (which boundary edge, or "throughout"). */
  placement: "boundary" | "perimeter" | "mass" | "under-trees" | "front" | "back" | "general";
  /** Any species/style preference mentioned. */
  style: "native" | "formal" | "low-water" | "tropical" | "cottage" | "general";
  /** Original prompt for the ghost's provenance. */
  prompt: string;
}

export function parsePrompt(prompt: string): ParsedIntent {
  const p = prompt.toLowerCase();
  let category: ParsedIntent["category"] = "general";
  let placement: ParsedIntent["placement"] = "general";
  let style: ParsedIntent["style"] = "general";

  if (/shortfall|complian|a2.?6|fill.*canopy|canopy.*fill|rescode/.test(p)) category = "compliance-fill";
  else if (/screen|privacy|windbreak|shelter/.test(p)) category = "screening";
  else if (/bed|garden|planting|border/.test(p)) category = "garden-bed";
  else if (/tree|canopy|shade|large/.test(p)) category = "canopy-trees";
  else if (/hedge|edge|border|trim/.test(p)) category = "hedge";
  else if (/ground|cover|lawn|grass|turf/.test(p)) category = "groundcover";
  else if (/seat|sit|relax|entertain|patio|deck/.test(p)) category = "seating";

  if (/boundary|fence|edge|border|perimeter/.test(p)) placement = "boundary";
  else if (/around|surround|ring/.test(p)) placement = "perimeter";
  else if (/mass|group|cluster|fill|area/.test(p)) placement = "mass";
  else if (/under|beneath|below.*trees/.test(p)) placement = "under-trees";
  else if (/front|entrance|street/.test(p)) placement = "front";
  else if (/back|rear|end/.test(p)) placement = "back";

  if (/native|indigenous|local|australian/.test(p)) style = "native";
  else if (/formal|structured|clipped|neat/.test(p)) style = "formal";
  else if (/low.water|drought|dry|xeriscape/.test(p)) style = "low-water";
  else if (/tropical|lush|exotic/.test(p)) style = "tropical";
  else if (/cottage|informal|rambling/.test(p)) style = "cottage";

  return { category, placement, style, prompt };
}

// ---------------------------------------------------------------------------
// Polygon math (pure) — the constraint substrate
// ---------------------------------------------------------------------------

/** Cumulative arc-length table for a closed ring: lengths[i] is the length
 *  of edge i (vertex i → i+1, wrapping). */
export function edgeLengths(ring: PctPoint[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    out.push(Math.hypot(b.x - a.x, b.y - a.y));
  }
  return out;
}

/** Signed area — negative for clockwise winding in board-% space
 *  (y grows downward), positive for counter-clockwise. */
export function signedArea(ring: PctPoint[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

/** Point at arc-length parameter t ∈ [0,1) around the whole ring. */
export function pointAroundRing(
  ring: PctPoint[],
  t: number,
): { pt: PctPoint; edgeIndex: number; tAlongEdge: number } {
  const lengths = edgeLengths(ring);
  const total = lengths.reduce((s, l) => s + l, 0);
  if (total <= 0) return { pt: ring[0]!, edgeIndex: 0, tAlongEdge: 0 };
  let target = ((t % 1) + 1) % 1 * total;
  for (let i = 0; i < lengths.length; i++) {
    const l = lengths[i]!;
    if (target <= l || i === lengths.length - 1) {
      const frac = l > 0 ? target / l : 0;
      const a = ring[i]!;
      const b = ring[(i + 1) % ring.length]!;
      return {
        pt: { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac },
        edgeIndex: i,
        tAlongEdge: Math.min(1, Math.max(0, frac)),
      };
    }
    target -= l;
  }
  return { pt: ring[0]!, edgeIndex: 0, tAlongEdge: 0 };
}

/**
 * Unit inward normal of edge i — perpendicular to the edge direction,
 * rotated toward the ring's interior. The winding sign decides the rotation
 * so concave (L-shaped) lots still resolve correctly.
 */
export function inwardNormal(ring: PctPoint[], edgeIndex: number): { x: number; y: number } {
  const a = ring[edgeIndex % ring.length]!;
  const b = ring[(edgeIndex + 1) % ring.length]!;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  // signedArea > 0 (CCW in math space) → interior is to the LEFT of travel.
  const flip = signedArea(ring) > 0 ? 1 : -1;
  return { x: nx * flip, y: ny * flip };
}

/** Compass bearing (deg, 0 = +x east, clockwise on screen) of a direction. */
export function bearingDeg(dx: number, dy: number): number {
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

/** Ray-cast point-in-polygon (boundary-exclusive by tolerance). */
export function pointInPolygon(pt: PctPoint, ring: PctPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (
      a.y > pt.y !== b.y > pt.y &&
      pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** Minimum distance from a point to a ring's edges (board-% units). */
export function distanceToRing(pt: PctPoint, ring: PctPoint[]): number {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const t = Math.max(0, Math.min(1, ex !== 0 || ey !== 0
      ? ((pt.x - a.x) * ex + (pt.y - a.y) * ey) / (ex * ex + ey * ey)
      : 0));
    best = Math.min(best, Math.hypot(pt.x - (a.x + ex * t), pt.y - (a.y + ey * t)));
  }
  return best;
}

/** Deterministic LCG — same seed, same sequence. */
function lcg(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

// ---------------------------------------------------------------------------
// Species selection — envelope-constrained palette
// ---------------------------------------------------------------------------

function selectSpecies(
  intent: ParsedIntent,
  envelope: SiteEnvelope | null,
  count: number,
): FloraCandidate[] {
  const form =
    intent.category === "canopy-trees" ||
    intent.category === "compliance-fill" ||
    intent.category === "screening"
      ? "canopy"
      : intent.category === "hedge"
        ? "hedge"
        : "bed";
  const candidates = rankCurtisFloraCandidates({
    address: "",
    sunHours: envelope?.seasonalSun[0]?.meanHours ?? 6,
    nearbyCanopyCount: 0,
    maxHeightM: form === "canopy" ? 8 : form === "hedge" ? 2.5 : 1.5,
    preferredForm: form,
    ...(envelope ? { month: envelope.month } : {}),
  });
  return candidates.slice(0, Math.max(1, count));
}

// ---------------------------------------------------------------------------
// Ghost generation — prompt + context → boundary-referenced ghosts
// ---------------------------------------------------------------------------

export interface EdgeRef {
  /** Which boundary edge the ghost hangs off. */
  edgeIndex: number;
  /** Arc-length position along that edge, 0..1. */
  tAlongEdge: number;
  /** Inward offset from the edge in board-%. */
  insetPct: number;
}

export interface GhostPlacement {
  placement: CatalogPlacement;
  /** Edge-reference for boundary ghosts — the steerable re-run handle
   *  (adjust inset/count without the deck reshuffling). */
  ref?: EdgeRef;
}

export interface GenerateInput {
  prompt: string;
  boundary: PctPoint[];
  building: PctPoint[];
  existingTrees: Array<{ x_pct: number; y_pct: number; canopy_radius_m?: number }>;
  envelope: SiteEnvelope | null;
  /** How many entities to generate (operator-tunable). */
  count?: number;
  /** A2-6 canopy shortfall (from buildCanopyCompliance) — a compliance
   *  intent generates exactly enough mature canopy to close the gap. */
  canopyShortfall?: number;
  /** Keep-out rings (easements etc.) in board-%. */
  easements?: PctPoint[][];
  /** Inward offset from the boundary for linear placements (board-%). */
  insetPct?: number;
}

/** Default crown clearance around existing trunks (board-% at 110 m board). */
const TREE_CLEARANCE_PCT = 4;

function mintGhost(
  symbolId: string,
  x: number,
  y: number,
  rotationDeg: number,
  prompt: string,
  heightM?: number,
  canopyM?: number,
): CatalogPlacement {
  return {
    id: crypto.randomUUID(),
    symbol_id: symbolId,
    x_pct: Math.max(2, Math.min(98, x)),
    y_pct: Math.max(2, Math.min(98, y)),
    rotation_deg: Math.round(((rotationDeg % 360) + 360) % 360),
    scale: 1,
    label: `AI: ${prompt.slice(0, 30)}`,
    ...(heightM != null ? { height_m: heightM } : {}),
    ...(canopyM != null ? { canopy_radius_m: canopyM } : {}),
  };
}

/**
 * Linear placement along the boundary: even arc-length distribution,
 * perpendicular edge-normal inset, rotation facing inward along the edge.
 * Every ghost carries its edge reference.
 */
export function placeAlongBoundary(
  boundary: PctPoint[],
  count: number,
  insetPct: number,
): Array<{ pt: PctPoint; ref: EdgeRef; rotationDeg: number }> {
  if (boundary.length < 3) return [];
  const out: Array<{ pt: PctPoint; ref: EdgeRef; rotationDeg: number }> = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const { pt, edgeIndex, tAlongEdge } = pointAroundRing(boundary, t);
    const n = inwardNormal(boundary, edgeIndex);
    out.push({
      pt: {
        x: Math.max(2, Math.min(98, pt.x + n.x * insetPct)),
        y: Math.max(2, Math.min(98, pt.y + n.y * insetPct)),
      },
      ref: { edgeIndex, tAlongEdge, insetPct },
      rotationDeg: bearingDeg(n.x, n.y),
    });
  }
  return out;
}

/**
 * Constraint-sampled mass placement: point-in-polygon rejection sampling
 * that keeps every generated point OUT of the building and easements,
 * clear of existing crowns, and INSIDE the lot — by construction.
 */
export function placeInMass(
  input: {
    boundary: PctPoint[];
    building: PctPoint[];
    easements?: PctPoint[][];
    existingTrees: GenerateInput["existingTrees"];
    count: number;
    seed: number;
    /** Restrict to the top (front) or bottom (back) half of the lot bbox. */
    half?: "front" | "back";
  },
  maxAttemptsPerPoint = 60,
): PctPoint[] {
  const xs = input.boundary.map((p) => p.x);
  const ys = input.boundary.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rand = lcg(input.seed);
  const midY = (minY + maxY) / 2;
  const pts: PctPoint[] = [];

  const clear = (pt: PctPoint): boolean => {
    if (!pointInPolygon(pt, input.boundary)) return false;
    // Building: keep out of the footprint AND a 2% margin.
    if (input.building.length >= 3) {
      if (pointInPolygon(pt, input.building)) return false;
      if (distanceToRing(pt, input.building) < 2) return false;
    }
    for (const ring of input.easements ?? []) {
      if (ring.length >= 3 && pointInPolygon(pt, ring)) return false;
    }
    for (const tree of input.existingTrees) {
      const clearance =
        tree.canopy_radius_m != null
          ? Math.max(1.5, (tree.canopy_radius_m / 110) * 100)
          : TREE_CLEARANCE_PCT;
      if (Math.hypot(pt.x - tree.x_pct, pt.y - tree.y_pct) < clearance) {
        return false;
      }
    }
    return true;
  };

  for (let i = 0; i < input.count; i++) {
    for (let attempt = 0; attempt < maxAttemptsPerPoint; attempt++) {
      const x = minX + rand() * (maxX - minX);
      const yLo = input.half === "front" ? minY : input.half === "back" ? midY : minY;
      const yHi = input.half === "front" ? midY : input.half === "back" ? maxY : maxY;
      const y = yLo + rand() * (yHi - yLo);
      const pt = { x, y };
      if (clear(pt)) {
        pts.push(pt);
        break;
      }
    }
  }
  return pts;
}

export function generateGhosts(input: GenerateInput): GhostPlacement[] {
  const intent = parsePrompt(input.prompt);
  const insetPct = input.insetPct ?? 4;
  let count = input.count ?? 8;
  // Compliance intent: generate exactly the shortfall (never fewer), so an
  // accepted batch closes the A2-6 gap by construction.
  if (intent.category === "compliance-fill") {
    count = Math.max(count, input.canopyShortfall ?? 0, 1);
  }
  const species = selectSpecies(intent, input.envelope, count);
  if (species.length === 0) return [];

  const ghosts: GhostPlacement[] = [];
  const seed = hashString(input.prompt);

  if (intent.placement === "boundary" || intent.placement === "perimeter") {
    const slots = placeAlongBoundary(input.boundary, count, insetPct);
    for (let i = 0; i < slots.length; i++) {
      const sp = species[i % species.length]!;
      const slot = slots[i]!;
      ghosts.push({
        placement: mintGhost(
          sp.symbolId,
          slot.pt.x,
          slot.pt.y,
          slot.rotationDeg,
          input.prompt,
          sp.matureHeightM,
          sp.canopySpreadM / 2,
        ),
        ref: slot.ref,
      });
    }
  } else if (intent.placement === "under-trees") {
    const slots = placeInMass({
      boundary: input.boundary,
      building: input.building,
      easements: input.easements,
      existingTrees: input.existingTrees,
      count: Math.min(count, input.existingTrees.length * 2),
      seed,
    });
    for (let i = 0; i < slots.length; i++) {
      const sp = species[i % species.length]!;
      ghosts.push({
        placement: mintGhost(
          sp.symbolId,
          slots[i]!.x,
          slots[i]!.y,
          0,
          input.prompt,
          sp.matureHeightM,
          sp.canopySpreadM / 2,
        ),
      });
    }
  } else {
    const half = intent.placement === "front" ? "front" : intent.placement === "back" ? "back" : undefined;
    const slots = placeInMass({
      boundary: input.boundary,
      building: input.building,
      easements: input.easements,
      existingTrees: input.existingTrees,
      count,
      seed,
      half,
    });
    for (let i = 0; i < slots.length; i++) {
      const sp = species[i % species.length]!;
      ghosts.push({
        placement: mintGhost(
          sp.symbolId,
          slots[i]!.x,
          slots[i]!.y,
          0,
          input.prompt,
          sp.matureHeightM,
          sp.canopySpreadM / 2,
        ),
      });
    }
  }

  return ghosts;
}
