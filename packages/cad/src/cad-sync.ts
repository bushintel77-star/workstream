import type {
  CadDocument,
  CadEntity,
  CadSyncAsset,
  CadSyncManifest,
  CadSyncProxy,
} from "@workstream/contracts";

const HONESTY_NOTE = "Working plan metres — confirm on site";

function ringSpanM(points: Array<{ x: number; y: number }>): number {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return Math.hypot(maxX - minX, maxY - minY);
}

function proxyFor(
  e: CadEntity,
  doc: CadDocument,
): { proxy: CadSyncProxy; height_m?: number; radius_m?: number } {
  switch (e.kind) {
    case "polyline": {
      if (e.closed && e.points.length >= 3) {
        if (e.layer === "HARDSCAPE") return { proxy: "slab", height_m: 0.05 };
        if (e.layer === "STRUCTURES") {
          const span = ringSpanM(e.points);
          const boardDiag = Math.hypot(doc.width_m, doc.height_m);
          const height_m = span > boardDiag * 0.35 ? 0.25 : 3;
          return { proxy: "wall", height_m };
        }
        return { proxy: "wall", height_m: 0.15 };
      }
      return { proxy: "ribbon", height_m: 0.12 };
    }
    case "line":
      return { proxy: "ribbon", height_m: 0.12 };
    case "circle":
      return { proxy: "cylinder", height_m: 0.4, radius_m: e.radius };
    case "insert": {
      const radius_m = Math.max(0.25, 0.4 * (e.scale ?? 1));
      const planting =
        e.layer.toUpperCase().includes("PLANT") ||
        e.layer.toUpperCase() === "TRP";
      return {
        proxy: "cylinder",
        height_m: planting ? 1.8 * (e.scale ?? 1) : 0.6,
        radius_m,
      };
    }
    case "text":
    case "dimension":
    case "arc":
      return { proxy: "skip" };
    default:
      return { proxy: "skip" };
  }
}

function symbolIdFor(doc: CadDocument, e: CadEntity): string | null {
  if (e.kind !== "insert") return null;
  const block = doc.blocks.find((b) => b.name === e.block_name);
  return block?.symbol_id ?? e.block_name ?? null;
}

/**
 * Stable per-entity asset list for glTF extras + UE5 live-sync manifest.
 * Ghosts are omitted — only accepted / verified geometry syncs out.
 */
export function collectCadSyncAssets(doc: CadDocument): CadSyncAsset[] {
  const out: CadSyncAsset[] = [];
  for (const e of doc.entities) {
    if (e.ghost) continue;
    const { proxy, height_m, radius_m } = proxyFor(e, doc);
    const asset: CadSyncAsset = {
      entity_id: e.id,
      kind: e.kind,
      layer: e.layer,
      symbol_id: symbolIdFor(doc, e),
      block_name: e.kind === "insert" ? e.block_name : null,
      proxy,
      ...(height_m != null ? { height_m } : {}),
      ...(radius_m != null ? { radius_m } : {}),
    };
    if (e.kind === "insert") {
      asset.x = e.position.x;
      asset.y = e.position.y;
    } else if (e.kind === "circle") {
      asset.x = e.center.x;
      asset.y = e.center.y;
    } else if (e.kind === "polyline" && e.points[0]) {
      asset.x = e.points[0].x;
      asset.y = e.points[0].y;
    } else if (e.kind === "line") {
      asset.x = e.start.x;
      asset.y = e.start.y;
    }
    out.push(asset);
  }
  return out;
}

/**
 * Manifest an Unreal / Datasmith-side importer polls. Geometry bytes stay on
 * gltf_path / dxf_path — this file is the ID + honesty contract.
 */
export function buildCadSyncManifest(doc: CadDocument): CadSyncManifest {
  const ghosts = doc.entities.filter((e) => e.ghost).length;
  return {
    version: "cad-sync/1",
    project_id: doc.project_id,
    document_id: doc.id,
    updated_at: doc.updated_at,
    honesty: "working_plan",
    note: HONESTY_NOTE,
    width_m: doc.width_m,
    height_m: doc.height_m,
    units: "m",
    gltf_path: `/projects/${doc.project_id}/cad.gltf`,
    dxf_path: `/projects/${doc.project_id}/cad.dxf`,
    poll_hint_s: 15,
    assets: collectCadSyncAssets(doc),
    ghost_count: ghosts,
  };
}
