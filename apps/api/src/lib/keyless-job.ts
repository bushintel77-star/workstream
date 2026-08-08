import type { Store } from "@workstream/db";
import type {
  DesignKeylessOverlay,
  GeoCoords,
  KeylessOverlayKind,
} from "@workstream/contracts";
import {
  deriveCornerLevels,
  geoToCanvasMetres,
  type ContourLine,
} from "@workstream/domain";
import {
  fetchKeylessRings,
  type VicmapKeylessKind,
} from "./vicmap";

/**
 * Default KEYLESS washes — street context (water corp / road casement) after
 * planning / bushfire / contour / flood / heritage. Urban trees hydrate as
 * point ghosts via auto-trace, not polygon wash.
 */
const DEFAULT_KINDS: VicmapKeylessKind[] = [
  "planning",
  "bushfire",
  "contour",
  "flood",
  "heritage",
  "water_corp",
  "road_casement",
];

function openRing(
  ring: Array<[number, number]>,
): Array<[number, number]> {
  if (ring.length < 2) return ring;
  const a = ring[0]!;
  const b = ring[ring.length - 1]!;
  if (a[0] === b[0] && a[1] === b[1]) return ring.slice(0, -1);
  return ring;
}

/**
 * Hydrate KEYLESS Vicmap overlays for a project pin.
 * Returns canvas-metre rings co-registered to the site boundary origin when
 * available; otherwise raw WGS84 → local metres from the pin as origin.
 */
export async function hydrateKeylessOverlays(
  store: Store,
  ownerId: string,
  projectId: string,
  kinds: VicmapKeylessKind[] = DEFAULT_KINDS,
): Promise<{
  overlays_canvas: Array<{
    kind: KeylessOverlayKind;
    rings: Array<Array<{ x: number; y: number }>>;
    label: string | null;
    fetched_at: string;
  }>;
  /**
   * Contour-derived spot levels at boundary corners (board % coords).
   * Only present when contour data was fetched and interpolation succeeded.
   * These are indicative (±0.5–1 m) and never override authored levels.
   */
  derived_levels: Array<{
    x_pct: number;
    y_pct: number;
    z_m: number;
    source: "vicmap_contour";
    accuracy_m: number;
  }>;
  source: "vicmap" | "empty";
}> {
  const project = await store.getProject(ownerId, projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  if (project.lat == null || project.lng == null) {
    return { overlays_canvas: [], derived_levels: [], source: "empty" };
  }

  const boundary = await store.getSiteBoundary(ownerId, projectId);
  const origin: GeoCoords = boundary?.geo_reference.canvas_origin_geo ?? {
    lng: project.lng,
    lat: project.lat,
  };

  const fetched_at = new Date().toISOString();
  const overlays_canvas: Array<{
    kind: KeylessOverlayKind;
    rings: Array<Array<{ x: number; y: number }>>;
    label: string | null;
    fetched_at: string;
  }> = [];
  let derived_levels: Array<{
    x_pct: number;
    y_pct: number;
    z_m: number;
    source: "vicmap_contour";
    accuracy_m: number;
  }> = [];

  for (const kind of kinds) {
    try {
      const hit = await fetchKeylessRings(kind, project.lat, project.lng);
      if (!hit) continue;
      const rings = hit.rings.map((ring) =>
        openRing(ring).map(([lng, lat]) =>
          geoToCanvasMetres({ lng, lat }, origin),
        ),
      );
      overlays_canvas.push({
        kind: kind as KeylessOverlayKind,
        rings,
        label: hit.label,
        fetched_at,
      });

      // Contour-derived levels: interpolate at boundary corners.
      if (kind === "contour" && hit.elevations && boundary) {
        const contourLines: ContourLine[] = [];
        for (let i = 0; i < hit.rings.length; i++) {
          const elev = hit.elevations[i];
          if (elev == null) continue;
          const ring = openRing(hit.rings[i]!);
          if (ring.length < 2) continue;
          // Convert to canvas metres, then to % coords via the boundary vertices.
          const ptsM = ring.map(([lng, lat]) =>
            geoToCanvasMetres({ lng, lat }, origin),
          );
          // Convert canvas metres to % using the boundary's canvas-to-% transform.
          // The boundary vertices are in canvas metres; we need the same transform.
          // For now, use the boundary's vertex range as the scale reference.
          const bVerts = boundary.vertices ?? [];
          if (bVerts.length === 0) continue;
          const bPtsM = bVerts.map((v) => ({
            x: v.canvas_coords.x,
            y: v.canvas_coords.y,
          }));
          const bbox = bPtsM.reduce(
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
          if (w <= 0 || h <= 0) continue;
          const ptsPct = ptsM.map((p) => ({
            x: ((p.x - bbox.minX) / w) * 100,
            y: ((p.y - bbox.minY) / h) * 100,
          }));
          contourLines.push({ points: ptsPct, elevationM: elev });
        }
        if (contourLines.length > 0) {
          // Boundary corners in % coords.
          const bVerts = boundary.vertices ?? [];
          const bPtsM = bVerts.map((v) => ({
            x: v.canvas_coords.x,
            y: v.canvas_coords.y,
          }));
          const bbox = bPtsM.reduce(
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
          if (w > 0 && h > 0) {
            const cornersPct = bPtsM.map((p) => ({
              x: ((p.x - bbox.minX) / w) * 100,
              y: ((p.y - bbox.minY) / h) * 100,
            }));
            // Get existing authored levels from the design canvas.
            const canvas = await store.getDesignCanvas(ownerId, projectId);
            const existing = (canvas?.site_frame?.levels ?? []).map((lv) => ({
              x_pct: lv.x_pct,
              y_pct: lv.y_pct,
              z_m: lv.z_m,
            }));
            derived_levels = deriveCornerLevels(
              contourLines,
              cornersPct,
              existing,
            );
          }
        }
      }
    } catch (err) {
      console.warn(`[keyless] ${kind} hydrate failed:`, err);
    }
  }

  return {
    overlays_canvas,
    derived_levels,
    source: overlays_canvas.length > 0 ? "vicmap" : "empty",
  };
}

/** Convert canvas-metre overlay rings → DesignCanvas site_frame % overlays. */
export function canvasOverlaysToDesign(
  overlays: Array<{
    kind: KeylessOverlayKind;
    rings: Array<Array<{ x: number; y: number }>>;
    label: string | null;
    fetched_at: string;
  }>,
  toPct: (pt: { x: number; y: number }) => { x_pct: number; y_pct: number },
): DesignKeylessOverlay[] {
  return overlays.map((ov) => ({
    kind: ov.kind,
    label: ov.label ?? undefined,
    fetched_at: ov.fetched_at,
    rings: ov.rings.map((ring) => ring.map(toPct)),
  }));
}
