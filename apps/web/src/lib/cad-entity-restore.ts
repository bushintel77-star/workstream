import type { CadEntity, CadOp } from "@workstream/contracts";
import type { CadEntityLite } from "./canvas-types";

/** Build a replace_entity op from a client CadEntityLite when geometry is known. */
export function replaceOpFromLite(entity: CadEntityLite): CadOp | null {
  const base = {
    id: entity.id,
    layer: entity.layer ?? "HARDSCAPE",
    verification_state: (entity.verification_state ??
      (entity.ghost ? "UNVERIFIED" : "VERIFIED")) as
      | "UNVERIFIED"
      | "VERIFIED",
    ghost: entity.ghost,
  };

  if (entity.kind === "line" && entity.start && entity.end) {
    return {
      op: "replace_entity",
      entity: {
        ...base,
        kind: "line",
        start: entity.start,
        end: entity.end,
      } satisfies CadEntity,
    };
  }
  if (entity.kind === "polyline" && entity.points && entity.points.length >= 2) {
    return {
      op: "replace_entity",
      entity: {
        ...base,
        kind: "polyline",
        points: entity.points,
        closed: entity.closed ?? false,
      } satisfies CadEntity,
    };
  }
  if (entity.kind === "circle" && entity.center && entity.radius) {
    return {
      op: "replace_entity",
      entity: {
        ...base,
        kind: "circle",
        center: entity.center,
        radius: entity.radius,
      } satisfies CadEntity,
    };
  }
  if (
    entity.kind === "insert" &&
    entity.position &&
    entity.block_name
  ) {
    return {
      op: "replace_entity",
      entity: {
        ...base,
        kind: "insert",
        block_name: entity.block_name,
        position: entity.position,
        scale: 1,
        rotation_deg: 0,
      } satisfies CadEntity,
    };
  }
  return null;
}
