/**
 * Indicative landscape lighting conduit + watering plan (Workflow 1).
 * AI proposes; operator accepts by keeping / redrawing zones — no hydraulics.
 */

import type { IrrigationZoneKind } from "@workstream/contracts";

export type ServicePct = { x: number; y: number };

export type LandscapeServiceItem = {
  t: string;
  x: number;
  y: number;
  /** Catalog symbol when known (lighting fixtures, etc.). */
  symbolId?: string;
};

export type LandscapeServiceZoneIn = {
  kind?: string;
  points: ServicePct[];
};

export type ProposedServiceZone = {
  name: string;
  kind: IrrigationZoneKind;
  points: ServicePct[];
  emitter_spacing_cm?: number;
  emitter_flow_lph?: number;
  fixture_spacing_m?: number;
};

export type LandscapeServiceProposal = {
  zones: ProposedServiceZone[];
  tip: string;
  wateringMode: "agg_drain" | "spray" | "none";
};

export function zoneKindShortLabel(kind: IrrigationZoneKind | string): string {
  switch (kind) {
    case "lighting":
      return "Light";
    case "lighting_conduit":
      return "LV conduit";
    case "spray":
      return "Spray";
    case "agg_drain":
      return "Agg drain";
    case "drip":
    default:
      return "Drip";
  }
}

export function zoneKindDrawHint(kind: IrrigationZoneKind | string): string {
  switch (kind) {
    case "lighting":
      return "Lighting fixture run";
    case "lighting_conduit":
      return "LV conduit trench · end at house main";
    case "spray":
      return "Sprinkler lateral";
    case "agg_drain":
      return "Aggregate / ag-pipe drain";
    case "drip":
    default:
      return "Drip zone";
  }
}

/** True for Curtis / Temaki lighting catalog symbols. */
export function isLightingSymbolId(symbolId: string): boolean {
  const k = symbolId.toLowerCase();
  return /light|lighting|bollard|uplight|spike|graze|wash|led-/.test(k);
}

/** Pull fixture board-% points from durable catalog placements. */
export function fixturesFromPlacements(
  placements: Array<{ symbol_id: string; x_pct: number; y_pct: number }>,
): ServicePct[] {
  return placements
    .filter((p) => isLightingSymbolId(p.symbol_id))
    .map((p) => ({ x: p.x_pct, y: p.y_pct }));
}

/** Nearest point on a polyline/ring to `p` (board %). */
export function nearestPointOnRing(
  p: ServicePct,
  ring: ServicePct[],
): ServicePct | null {
  if (ring.length < 2) return null;
  let best: ServicePct | null = null;
  let bestD = Infinity;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const a = ring[i]!;
    const b = ring[i + 1]!;
    const q = projectOnSegment(p, a, b);
    const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = q;
    }
  }
  const a = ring[ring.length - 1]!;
  const b = ring[0]!;
  if (a.x !== b.x || a.y !== b.y) {
    const q = projectOnSegment(p, a, b);
    const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
    if (d < bestD) best = q;
  }
  return best;
}

function projectOnSegment(
  p: ServicePct,
  a: ServicePct,
  b: ServicePct,
): ServicePct {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return { x: a.x, y: a.y };
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

function mid(a: ServicePct, b: ServicePct): ServicePct {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function hasKind(zones: LandscapeServiceZoneIn[], kind: string): boolean {
  return zones.some((z) => (z.kind ?? "drip") === kind);
}

function polylineLenPct(pts: ServicePct[]): number {
  let sum = 0;
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    sum += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return sum;
}

function pushConduit(
  out: ProposedServiceZone[],
  from: ServicePct,
  building: ServicePct[],
  name: string,
): void {
  const fit = nearestPointOnRing(from, building);
  if (!fit) return;
  if (Math.hypot(fit.x - from.x, fit.y - from.y) < 1.5) return;
  out.push({
    name,
    kind: "lighting_conduit",
    points: [from, mid(from, fit), fit],
    fixture_spacing_m: 2.5,
  });
}

/**
 * Propose LV conduit trenches (fit-off to house) + watering
 * (aggregate drain if frenchdrain present, else sprinkler laterals).
 *
 * Fixture priority: catalog lighting points → lighting zones → hardscape.
 */
export function proposeLandscapeServiceZones(args: {
  building: ServicePct[];
  items: LandscapeServiceItem[];
  zones: LandscapeServiceZoneIn[];
  /** Catalog lighting fixture positions (board %). */
  fixtures?: ServicePct[];
  /** Lot boundary for agg-drain PoD snap. */
  boundary?: ServicePct[];
}): LandscapeServiceProposal {
  const out: ProposedServiceZone[] = [];
  const building = args.building;
  const items = args.items;
  const zones = args.zones;
  const boundary = args.boundary ?? [];

  const fromItems = items
    .filter((i) => i.symbolId && isLightingSymbolId(i.symbolId))
    .map((i) => ({ x: i.x, y: i.y }));
  const fixtures = [...(args.fixtures ?? []), ...fromItems];

  // --- Lighting conduit → house main fit-off ---
  if (!hasKind(zones, "lighting_conduit") && building.length >= 3) {
    const lightRuns = zones.filter((z) => (z.kind ?? "") === "lighting");
    const hardscape = items.filter(
      (i) => i.t === "paving" || i.t === "deck",
    );

    if (fixtures.length >= 1) {
      const sorted = [...fixtures].sort((a, b) => a.x - b.x || a.y - b.y);
      const pts =
        sorted.length === 1
          ? [sorted[0]!, { x: sorted[0]!.x + 5, y: sorted[0]!.y + 2 }]
          : sorted;
      if (!hasKind(zones, "lighting")) {
        out.push({
          name: "Fixture lighting",
          kind: "lighting",
          points: pts,
          fixture_spacing_m: 2.5,
        });
      }
      pushConduit(out, pts[pts.length - 1]!, building, "LV trench 1");
    } else if (lightRuns.length > 0) {
      lightRuns.forEach((run, idx) => {
        const tip = run.points[run.points.length - 1];
        if (!tip) return;
        pushConduit(out, tip, building, `LV trench ${idx + 1}`);
      });
    } else if (hardscape.length >= 1) {
      const sorted = [...hardscape].sort((a, b) => a.x - b.x || a.y - b.y);
      const fixturePts = sorted.map((h) => ({ x: h.x, y: h.y }));
      if (fixturePts.length === 1) {
        const only = fixturePts[0]!;
        fixturePts.push({ x: only.x + 6, y: only.y + 2 });
      }
      out.push({
        name: "Path lighting",
        kind: "lighting",
        points: fixturePts,
        fixture_spacing_m: 2.5,
      });
      pushConduit(
        out,
        fixturePts[fixturePts.length - 1]!,
        building,
        "LV trench 1",
      );
    }
  }

  // --- Watering: agg drain OR sprinkler piping ---
  let wateringMode: LandscapeServiceProposal["wateringMode"] = "none";
  let sprayHeads = 0;
  let sprayValves = 0;
  const drains = items.filter((i) => i.t === "frenchdrain");
  const soft = items.filter(
    (i) => i.t === "lawn" || i.t === "bed" || i.t === "hedge",
  );

  if (!hasKind(zones, "agg_drain") && !hasKind(zones, "spray")) {
    if (drains.length >= 1) {
      wateringMode = "agg_drain";
      const sorted = [...drains].sort((a, b) => a.x - b.x || a.y - b.y);
      const pts = sorted.map((d) => ({ x: d.x, y: d.y }));
      if (pts.length === 1) {
        const p = pts[0]!;
        pts.push({ x: Math.min(92, p.x + 12), y: Math.min(88, p.y + 4) });
      }
      const last = pts[pts.length - 1]!;
      const pod =
        boundary.length >= 3
          ? nearestPointOnRing(last, boundary)
          : {
              x: Math.min(95, last.x + 4),
              y: Math.min(92, last.y + 6),
            };
      if (pod) pts.push(pod);
      out.push({
        name: "Agg drain run",
        kind: "agg_drain",
        points: pts,
        emitter_spacing_cm: 100,
        emitter_flow_lph: 0.1,
      });
    } else if (soft.length >= 1) {
      wateringMode = "spray";
      const sorted = [...soft].sort((a, b) => a.x - b.x || a.y - b.y);
      const pts = sorted.map((s) => ({ x: s.x, y: s.y }));
      if (pts.length === 1) {
        const p = pts[0]!;
        pts.push({ x: Math.min(90, p.x + 10), y: p.y + 3 });
      }
      const spacingM = 3.5;
      // ~ board % → m at scale 110: 1% ≈ 1.1 m
      const lenM = (polylineLenPct(pts) / 100) * 110;
      sprayHeads = Math.max(1, Math.ceil(lenM / spacingM));
      sprayValves = Math.max(1, Math.ceil(sprayHeads / 6));
      out.push({
        name: "Spray lateral 1",
        kind: "spray",
        points: pts,
        fixture_spacing_m: spacingM,
        emitter_spacing_cm: 350,
        emitter_flow_lph: 40,
      });
    }
  }

  const tipParts = ["Landscape services (indicative)"];
  const conduitN = out.filter((z) => z.kind === "lighting_conduit").length;
  const lightN = out.filter((z) => z.kind === "lighting").length;
  if (fixtures.length > 0 && conduitN > 0) {
    tipParts.push(
      `${fixtures.length} fixture${fixtures.length === 1 ? "" : "s"} → LV trench to house main — verify fit-off`,
    );
  } else if (conduitN > 0) {
    tipParts.push(
      `${conduitN} LV trench${conduitN === 1 ? "" : "es"} to house main — verify fit-off`,
    );
  } else if (lightN > 0) {
    tipParts.push("Path lighting proposed");
  }
  if (wateringMode === "agg_drain") {
    tipParts.push(
      boundary.length >= 3
        ? "Agg drain → boundary PoD — confirm legal point of discharge"
        : "Aggregate drain run — confirm outlet / legal point of discharge",
    );
  } else if (wateringMode === "spray") {
    tipParts.push(
      `Sprinkler plan · ~${sprayHeads} head${sprayHeads === 1 ? "" : "s"} · ~${sprayValves} valve${sprayValves === 1 ? "" : "s"} — confirm pressure on site`,
    );
  }
  if (out.length === 0) {
    tipParts.push(
      "Place fixtures / hardscape / frenchdrain / planting first, or draw Zone paths manually",
    );
  }

  return { zones: out, tip: tipParts.join(" · "), wateringMode };
}
