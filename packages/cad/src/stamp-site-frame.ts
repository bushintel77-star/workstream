import type {
  CadDocument,
  CadEntity,
  DesignCanvas,
  DesignSiteFramePoint,
} from "@workstream/contracts";

/** Board % → CadDocument metres (Y-up). Shared by sketch import + site stamp. */
export function pctToCadMetres(
  x_pct: number,
  y_pct: number,
  width_m: number,
  height_m: number,
): { x: number; y: number } {
  return {
    x: (x_pct / 100) * width_m,
    y: ((100 - y_pct) / 100) * height_m,
  };
}

function ringToMetres(
  ring: DesignSiteFramePoint[],
  width_m: number,
  height_m: number,
): Array<{ x: number; y: number }> {
  return ring.map((p) => pctToCadMetres(p.x_pct, p.y_pct, width_m, height_m));
}

/**
 * Stamp title boundary / dwelling / easements into an existing CadDocument
 * using the same %→m transform as sketch import. Idempotent for rings already
 * present is not required — callers stamp once on ensure/generate.
 */
export function stampSiteFrameToCad(
  doc: CadDocument,
  canvas: DesignCanvas | null | undefined,
): CadDocument {
  const frame = canvas?.site_frame;
  if (!frame) return doc;

  const { width_m, height_m } = doc;
  const added: CadEntity[] = [];

  if (frame.boundary.length >= 3) {
    added.push({
      id: crypto.randomUUID(),
      kind: "polyline",
      layer: "STRUCTURES",
      ghost: false,
      verification_state: "VERIFIED",
      closed: true,
      points: ringToMetres(frame.boundary, width_m, height_m),
    });
  }

  if (frame.building.length >= 3) {
    added.push({
      id: crypto.randomUUID(),
      kind: "polyline",
      layer: "STRUCTURES",
      ghost: false,
      verification_state: "VERIFIED",
      closed: true,
      points: ringToMetres(frame.building, width_m, height_m),
    });
  }

  for (const easement of frame.easements ?? []) {
    if (easement.length < 2) continue;
    added.push({
      id: crypto.randomUUID(),
      kind: "polyline",
      layer: "SERVICES",
      ghost: false,
      verification_state: "VERIFIED",
      closed: easement.length >= 3,
      points: ringToMetres(easement, width_m, height_m),
    });
  }

  if (added.length === 0) return doc;

  // Honesty callout — working plan metres, not survey set-out.
  added.push({
    id: crypto.randomUUID(),
    kind: "text",
    layer: "ANNOTATION",
    ghost: false,
    verification_state: "VERIFIED",
    position: { x: width_m * 0.04, y: height_m * 0.04 },
    height: 0.35,
    value: "Working plan metres — confirm on site",
    rotation_deg: 0,
  });

  return {
    ...doc,
    entities: [...doc.entities, ...added],
    source_sketch_id: doc.source_sketch_id ?? canvas?.id ?? null,
  };
}
