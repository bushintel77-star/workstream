"use client";

/**
 * Gold Standard 2026 — Site Truth Import (WebGL survey bridge).
 *
 * The classic studio ingests Vicmap auto-trace through its HITL boundary
 * flow; the WebGL mount had no bridge, so traced title/building/trees/
 * overlays never reached the canvas site_frame (elevation's empty-state
 * was the visible symptom). This runs the full live-data pull and writes
 * it into the design canvas, preserving everything already drawn:
 *
 *   boundary        ← Vicmap title parcel (canvas metres → board-%)
 *   building        ← Vicmap footprint when present (building_source=vicmap)
 *   easements       ← Vicmap easement lines (canvas metres → board-%)
 *   urban trees     ← placements, source=vicmap_tree (size from the data)
 *   keyless overlays← planning/bushfire/flood/heritage/water-corp washes
 *                     (server % are bbox-stretched; re-mapped through the
 *                      same metre frame for a consistent board)
 *
 * Board transform: uniform-scale fit with an 8% margin, centred — aspect
 * is preserved (no axis stretching) and board_width_m is set so 100 board
 * units equal the real metres the drawn width represents.
 */

import type { DesignCanvas } from "@workstream/contracts";

/* Local shapes mirroring the API payloads (lib/api is server-only — the
 * client reaches it through the server actions below). */
type TraceVertex = {
  sequence_index: number;
  canvas_coords: { x: number; y: number };
};
type AutoTraceData = {
  boundary: { vertices: TraceVertex[] };
  building_canvas: Array<{ x: number; y: number }>;
  easement_lines_canvas: Array<{ points: Array<{ x: number; y: number }> }>;
  urban_trees_canvas: Array<{
    x: number;
    y: number;
    canopy_radius_m?: number | null;
    height_m?: number | null;
    label?: string | null;
  }>;
};
type HydrateData = {
  overlays_canvas?: Array<{
    kind: "planning" | "bushfire" | "contour" | "flood" | "heritage" | "easement" | "urban_tree" | "water_corp" | "road_casement" | "acid_sulfate" | "wetland";
    rings: Array<Array<{ x: number; y: number }>>;
    label: string | null;
    fetched_at: string;
  }>;
  derived_levels?: Array<{
    x_pct: number;
    y_pct: number;
    z_m: number;
    accuracy_m: number;
  }>;
};


type Pt = { x: number; y: number };

export type SiteTruthImportResult = {
  boundaryPts: number;
  buildingPts: number;
  easements: number;
  levels: number;
  overlays: number;
  trees: number;
  boardWidthM: number | null;
};

/** Deterministic UUID for a Vicmap tree placement (idempotent imports). */
function treePlacementId(projectId: string, index: number): string {
  // Two 32-bit hashes → 16 bytes → canonical v4 UUID (version + variant
  // bits forced). Deterministic per project+index so re-running the import
  // is idempotent: the same tree yields the same id and is skipped.
  const h1 = Array.from(`${projectId}:${index}:a`).reduce(
    (h, c) => Math.imul(h, 31) + c.charCodeAt(0) >>> 0,
    0x9e3779b9,
  );
  const h2 = Array.from(`${projectId}:${index}:b`).reduce(
    (h, c) => Math.imul(h, 31) + c.charCodeAt(0) >>> 0,
    0x85ebca6b,
  );
  const b = new Uint8Array(16);
  new DataView(b.buffer).setUint32(0, h1);
  new DataView(b.buffer).setUint32(4, h2);
  new DataView(b.buffer).setUint32(8, h1 ^ 0x45d9f3b);
  new DataView(b.buffer).setUint32(12, h2 ^ 0x27220a95);
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10
  const hex = Array.from(b, (v) => v.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Uniform-fit board transform (canvas metres → board-%). */
function makeBoardTransform(boundaryMetres: Pt[]) {
  const bbox = boundaryMetres.reduce(
    (acc, p) => ({
      minX: Math.min(acc.minX, p.x),
      maxX: Math.max(acc.maxX, p.x),
      minY: Math.min(acc.minY, p.y),
      maxY: Math.max(acc.maxY, p.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );
  const w = bbox.maxX - bbox.minX;
  const h = bbox.maxY - bbox.minY;
  if (w <= 0 || h <= 0) return null;
  const DRAWN = 84; // % of the board the lot occupies (8% margin each side)
  const scale = Math.min(DRAWN / w, DRAWN / h);
  const clampPct = (v: number) => Math.min(100, Math.max(0, v));
  return {
    toPct: (m: Pt) => ({
      x_pct: clampPct(50 + (m.x - (bbox.minX + bbox.maxX) / 2) * scale),
      y_pct: clampPct(50 + (m.y - (bbox.minY + bbox.maxY) / 2) * scale),
    }),
    /** Real metres across the full 100-unit board width. */
    boardWidthM: w / ((w * scale) / 100),
    /** Invert the server's bbox-stretch (% → metres) for overlay washes.
     *  Overlays (pipes, zones) legitimately extend past the parcel — the
     *  board clips them at its edge, matching the canvas schema's 0-100. */
    unstretch: (p: Pt) => ({
      x: (p.x / 100) * w + bbox.minX,
      y: (p.y / 100) * h + bbox.minY,
    }),
  };
}

export async function importSiteTruth(
  projectId: string,
  currentCanvas: DesignCanvas | null,
): Promise<SiteTruthImportResult> {
  const { autoTraceBoundaryDataAction, hydrateKeylessDataAction } =
    await import("../../../app/actions");
  const trace: AutoTraceData = await autoTraceBoundaryDataAction(projectId);

  const boundaryMetres: Pt[] = (trace.boundary.vertices ?? [])
    .slice()
    .sort((a, b) => a.sequence_index - b.sequence_index)
    .map((v) => ({ x: v.canvas_coords.x, y: v.canvas_coords.y }));
  const tf = makeBoardTransform(boundaryMetres);
  if (!tf) throw new Error("Auto-trace returned no usable boundary");

  const boundary = boundaryMetres.map(tf.toPct);
  const building = (trace.building_canvas ?? []).map(tf.toPct);
  const easements = (trace.easement_lines_canvas ?? []).map((line) =>
    (line.points ?? []).map(tf.toPct),
  );

  // Urban trees → placements. Mature size comes from the Vicmap data
  // (canopy radius + height), never invented. Idempotent by id.
  const existingIds = new Set(
    (currentCanvas?.placements ?? []).map((p) => p.id),
  );
  const treePlacements = (trace.urban_trees_canvas ?? []).flatMap((t, i) => {
    const m = tf.toPct({ x: t.x, y: t.y });
    if (!Number.isFinite(m.x_pct) || !Number.isFinite(m.y_pct)) return [];
    // Contract: placement ids are UUIDs. Deterministic per project+index so
    // re-running the import is idempotent (same tree = same id = skipped).
    const id = treePlacementId(projectId, i);
    if (existingIds.has(id)) return [];
    return [
      {
        id,
        symbol_id: "tree-canopy",
        label: `${t.label ?? "Existing tree"} · ${(t.height_m ?? 8).toFixed(0)}m`,
        x_pct: m.x_pct,
        y_pct: m.y_pct,
        rotation_deg: 0,
        scale: Math.max(0.6, ((t.canopy_radius_m ?? 3) * 2) / 8),
        source: "vicmap_tree" as const,
      },
    ];
  });

  // Keyless overlays: server returns % under a bbox-stretch; re-map through
  // the metre frame so washes sit on the same board as the boundary.
  let overlays: NonNullable<DesignCanvas["site_frame"]>["keyless_overlays"] =
    [];
  let hydrated: HydrateData | null = null;
  try {
    hydrated = await hydrateKeylessDataAction(projectId);
    overlays = (hydrated.overlays_canvas ?? []).map((o) => ({
      kind: o.kind,
      rings: o.rings.map((ring) => ring.map(tf.unstretch).map(tf.toPct)),
      label: o.label ?? undefined,
      fetched_at: o.fetched_at ?? undefined,
    }));
  } catch {
    // Overlays are additive context — absence is not an error.
  }

  // Merge into the canvas, preserving placements/strokes/zones/trenches.
  // Authored levels always win; contour-derived levels ride along when the
  // server provides them (positions re-mapped through the metre frame).
  const frame: NonNullable<DesignCanvas["site_frame"]> = currentCanvas
    ?.site_frame ?? {
    boundary: [],
    building: [],
    easements: [],
    services: [],
    levels: [],
    drainage_runs: [],
    byda_assets: [],
    neighbour_buildings: [],
    keyless_overlays: [],
  };
  const authoredLevels = (frame.levels ?? []).filter(
    (l) => l.source === "authored" || l.source === "survey",
  );
  const derivedLevels = (hydrated?.derived_levels ?? []).flatMap(
    (l) => {
      const m = tf.unstretch({ x: l.x_pct, y: l.y_pct });
      const p = tf.toPct(m);
      return [
        {
          x_pct: p.x_pct,
          y_pct: p.y_pct,
          z_m: l.z_m,
          source: "vicmap_contour" as const,
          accuracy_m: l.accuracy_m,
        },
      ];
    },
  );

  const merged = {
    ...(currentCanvas ?? {}),
    placements: [...(currentCanvas?.placements ?? []), ...treePlacements],
    strokes: currentCanvas?.strokes ?? [],
    irrigation_zones: currentCanvas?.irrigation_zones ?? [],
    construction_trenches: currentCanvas?.construction_trenches ?? [],
    annotations: currentCanvas?.annotations ?? [],
    image_layers: currentCanvas?.image_layers ?? [],
    features: currentCanvas?.features ?? [],
    site_frame: {
      ...frame,
      boundary,
      building: building.length >= 3 ? building : (frame.building ?? []),
      building_source:
        building.length >= 3
          ? ("vicmap" as const)
          : (frame.building_source ?? undefined),
      easements: easements.length > 0 ? easements : (frame.easements ?? []),
      levels: [...authoredLevels, ...derivedLevels],
      keyless_overlays: overlays,
      board_width_m: tf.boardWidthM,
    },
  };

  const res = await fetch(`/api/projects/${projectId}/design-canvas`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      placements: merged.placements,
      strokes: merged.strokes,
      irrigation_zones: merged.irrigation_zones,
      construction_trenches: merged.construction_trenches,
      annotations: merged.annotations,
      image_layers: merged.image_layers,
      features: merged.features,
      site_frame: merged.site_frame,
      lifecycle_phase: currentCanvas?.lifecycle_phase,
      presentation_pack: currentCanvas?.presentation_pack ?? undefined,
    }),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as
      | { error?: string; issues?: Array<{ path: Array<string | number>; message: string }> }
      | null;
    const detail = payload?.issues
      ?.slice(0, 3)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(" | ");
    throw new Error(
      (payload?.error ?? `Canvas save failed (${res.status})`) +
        (detail ? ` — ${detail}` : ""),
    );
  }

  return {
    boundaryPts: boundary.length,
    buildingPts: building.length,
    easements: easements.length,
    levels: derivedLevels.length,
    overlays: overlays.length,
    trees: treePlacements.length,
    boardWidthM: tf.boardWidthM,
  };
}
