import type { Store } from "@workstream/db";
import type {
  DesignKeylessOverlay,
  GeoCoords,
  KeylessOverlayKind,
} from "@workstream/contracts";
import { geoToCanvasMetres } from "@workstream/domain";
import {
  fetchKeylessRings,
  type VicmapKeylessKind,
} from "./vicmap";

const DEFAULT_KINDS: VicmapKeylessKind[] = [
  "planning",
  "bushfire",
  "contour",
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
  source: "vicmap" | "empty";
}> {
  const project = await store.getProject(ownerId, projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  if (project.lat == null || project.lng == null) {
    return { overlays_canvas: [], source: "empty" };
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
    } catch (err) {
      console.warn(`[keyless] ${kind} hydrate failed:`, err);
    }
  }

  return {
    overlays_canvas,
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
