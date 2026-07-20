import type {
  CadDocument,
  CadEntity,
  CadOp,
  CadPoint2d,
  VerificationState,
} from "@workstream/contracts";

function newId(): string {
  return crypto.randomUUID();
}

function ensureLayer(doc: CadDocument, name: string, color?: number): void {
  if (doc.layers.some((l) => l.name === name)) return;
  doc.layers.push({ name, color: color ?? 7 });
}

/** True when entity is still an AI suggestion (legacy ghost or UNVERIFIED). */
export function isUnverified(e: {
  ghost?: boolean;
  verification_state?: VerificationState;
}): boolean {
  return e.ghost === true || e.verification_state === "UNVERIFIED";
}

function verificationFromGhost(ghost: boolean | undefined): {
  ghost: boolean;
  verification_state: VerificationState;
} {
  const unverified = ghost !== false;
  return {
    ghost: unverified,
    verification_state: unverified ? "UNVERIFIED" : "VERIFIED",
  };
}

/** Offset a closed/open polyline roughly along average edge normals (indicative). */
function offsetPolyline(
  points: CadPoint2d[],
  distance: number,
  closed: boolean,
): CadPoint2d[] {
  if (points.length < 2) return points;
  const n = points.length;
  const out: CadPoint2d[] = [];
  for (let i = 0; i < n; i++) {
    const prev = points[closed ? (i - 1 + n) % n : Math.max(0, i - 1)]!;
    const cur = points[i]!;
    const next = points[closed ? (i + 1) % n : Math.min(n - 1, i + 1)]!;
    const dx1 = cur.x - prev.x;
    const dy1 = cur.y - prev.y;
    const dx2 = next.x - cur.x;
    const dy2 = next.y - cur.y;
    const l1 = Math.hypot(dx1, dy1) || 1;
    const l2 = Math.hypot(dx2, dy2) || 1;
    const nx = -(dy1 / l1 + dy2 / l2);
    const ny = dx1 / l1 + dx2 / l2;
    const nl = Math.hypot(nx, ny) || 1;
    out.push({
      x: cur.x + (nx / nl) * distance,
      y: cur.y + (ny / nl) * distance,
    });
  }
  return out;
}

/**
 * Apply deterministic CadOps to a document (mutates a clone).
 * Unknown / invalid ops are skipped.
 */
export function applyCadOps(
  input: CadDocument,
  ops: CadOp[],
): { document: CadDocument; applied: number; skipped: number } {
  const doc: CadDocument = structuredClone(input);
  let applied = 0;
  let skipped = 0;

  for (const op of ops) {
    try {
      switch (op.op) {
        case "add_layer": {
          ensureLayer(doc, op.name, op.color);
          applied++;
          break;
        }
        case "add_line": {
          ensureLayer(doc, op.layer);
          doc.entities.push({
            id: newId(),
            kind: "line",
            layer: op.layer,
            ...verificationFromGhost(op.ghost),
            start: op.start,
            end: op.end,
          });
          applied++;
          break;
        }
        case "add_polyline": {
          ensureLayer(doc, op.layer);
          doc.entities.push({
            id: newId(),
            kind: "polyline",
            layer: op.layer,
            ...verificationFromGhost(op.ghost),
            points: op.points,
            closed: op.closed ?? false,
          });
          applied++;
          break;
        }
        case "add_circle": {
          ensureLayer(doc, op.layer);
          doc.entities.push({
            id: newId(),
            kind: "circle",
            layer: op.layer,
            ...verificationFromGhost(op.ghost),
            center: op.center,
            radius: op.radius,
          });
          applied++;
          break;
        }
        case "add_arc": {
          ensureLayer(doc, op.layer);
          doc.entities.push({
            id: newId(),
            kind: "arc",
            layer: op.layer,
            ...verificationFromGhost(op.ghost),
            center: op.center,
            radius: op.radius,
            start_angle_deg: op.start_angle_deg,
            end_angle_deg: op.end_angle_deg,
          });
          applied++;
          break;
        }
        case "add_text": {
          ensureLayer(doc, op.layer);
          doc.entities.push({
            id: newId(),
            kind: "text",
            layer: op.layer,
            ...verificationFromGhost(op.ghost),
            position: op.position,
            height: op.height ?? 0.35,
            value: op.value,
            rotation_deg: op.rotation_deg ?? 0,
          });
          applied++;
          break;
        }
        case "add_insert": {
          ensureLayer(doc, op.layer);
          if (!doc.blocks.some((b) => b.name === op.block_name)) {
            doc.blocks.push({
              name: op.block_name,
              symbol_id: op.block_name,
              entities: [],
            });
          }
          doc.entities.push({
            id: newId(),
            kind: "insert",
            layer: op.layer,
            ...verificationFromGhost(op.ghost),
            block_name: op.block_name,
            position: op.position,
            scale: op.scale ?? 1,
            rotation_deg: op.rotation_deg ?? 0,
          });
          applied++;
          break;
        }
        case "add_dim": {
          ensureLayer(doc, op.layer);
          doc.entities.push({
            id: newId(),
            kind: "dimension",
            layer: op.layer,
            ...verificationFromGhost(op.ghost),
            p1: op.p1,
            p2: op.p2,
            offset: op.offset ?? 0.5,
          });
          applied++;
          break;
        }
        case "offset_polyline": {
          const src = doc.entities.find((e) => e.id === op.entity_id);
          if (!src || src.kind !== "polyline") {
            skipped++;
            break;
          }
          ensureLayer(doc, src.layer);
          const pts = offsetPolyline(src.points, op.distance, src.closed);
          doc.entities.push({
            id: newId(),
            kind: "polyline",
            layer: src.layer,
            ...verificationFromGhost(op.ghost),
            points: pts,
            closed: src.closed,
          });
          applied++;
          break;
        }
        case "delete_entity": {
          const before = doc.entities.length;
          doc.entities = doc.entities.filter((e) => e.id !== op.entity_id);
          if (doc.entities.length < before) applied++;
          else skipped++;
          break;
        }
        case "replace_entity": {
          const entity = structuredClone(op.entity) as CadEntity;
          ensureLayer(doc, entity.layer);
          const idx = doc.entities.findIndex((e) => e.id === entity.id);
          if (idx >= 0) doc.entities[idx] = entity;
          else doc.entities.push(entity);
          if (entity.kind === "insert") {
            const blockName = entity.block_name;
            if (!doc.blocks.some((b) => b.name === blockName)) {
              doc.blocks.push({
                name: blockName,
                symbol_id: blockName,
                entities: [],
              });
            }
          }
          applied++;
          break;
        }
        default:
          skipped++;
      }
    } catch {
      skipped++;
    }
  }

  return { document: doc, applied, skipped };
}

/** Promote unverified / ghost entities to committed (optionally filtered by id). */
export function acceptUnverified(
  input: CadDocument,
  entityIds?: string[],
): CadDocument {
  const allow = entityIds ? new Set(entityIds) : null;
  const entities: CadEntity[] = input.entities.map((e) => {
    if (!isUnverified(e)) return e;
    if (allow && !allow.has(e.id)) return e;
    return { ...e, ghost: false, verification_state: "VERIFIED" as const };
  });
  return { ...input, entities };
}

/** @deprecated Prefer acceptUnverified */
export const acceptCadGhosts = acceptUnverified;

export function countGhosts(doc: CadDocument): number {
  return doc.entities.filter((e) => isUnverified(e)).length;
}
