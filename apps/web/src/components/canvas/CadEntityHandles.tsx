"use client";

import { useCallback, useState } from "react";
import type { CadOp } from "@workstream/contracts";
import type { CadEntityLite } from "../../lib/canvas-types";
import { replaceOpFromLite } from "../../lib/cad-entity-restore";
import css from "./cadEntityHandles.module.css";

type Props = {
  entities: CadEntityLite[];
  widthM: number;
  heightM: number;
  editActive?: boolean;
  onCommit: (ops: CadOp[]) => void;
};

type DragState = {
  entityId: string;
  pointIndex: number;
};

/**
 * CAD vertex handles in lot-metre sheet space (Y flipped to top-down %).
 */
export function CadEntityHandles({
  entities,
  widthM,
  heightM,
  editActive = false,
  onCommit,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CadEntityLite[] | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const list = draft ?? entities;
  const editable = list.filter(
    (e) =>
      (e.kind === "polyline" && (e.points?.length ?? 0) >= 2) ||
      (e.kind === "line" && e.start && e.end),
  );

  const toPct = useCallback(
    (x: number, y: number) => ({
      left: `${(x / widthM) * 100}%`,
      top: `${(1 - y / heightM) * 100}%`,
    }),
    [heightM, widthM],
  );

  const pointsOf = (e: CadEntityLite): Array<{ x: number; y: number }> => {
    if (e.kind === "polyline" && e.points) return e.points;
    if (e.kind === "line" && e.start && e.end) return [e.start, e.end];
    return [];
  };

  if (!editActive || widthM <= 0 || heightM <= 0 || editable.length === 0) {
    return null;
  }

  const selected = selectedId
    ? (list.find((e) => e.id === selectedId) ?? null)
    : null;

  return (
    <div
      className={css.root}
      data-testid="cad-entity-handles"
      onPointerMove={(ev) => {
        if (!drag) return;
        const el = ev.currentTarget;
        const r = el.getBoundingClientRect();
        const x = ((ev.clientX - r.left) / r.width) * widthM;
        const y = (1 - (ev.clientY - r.top) / r.height) * heightM;
        setDraft((prev) => {
          const base = prev ?? entities.map((e) => ({ ...e }));
          return base.map((e) => {
            if (e.id !== drag.entityId) return e;
            if (e.kind === "polyline" && e.points) {
              const points = e.points.map((p, i) =>
                i === drag.pointIndex ? { x, y } : p,
              );
              return { ...e, points };
            }
            if (e.kind === "line" && e.start && e.end) {
              if (drag.pointIndex === 0) return { ...e, start: { x, y } };
              return { ...e, end: { x, y } };
            }
            return e;
          });
        });
      }}
      onPointerUp={() => {
        if (!drag || !draft) {
          setDrag(null);
          return;
        }
        const entity = draft.find((e) => e.id === drag.entityId);
        const op = entity ? replaceOpFromLite(entity) : null;
        setDrag(null);
        setDraft(null);
        if (op) onCommit([op]);
      }}
    >
      {editable.map((e) => {
        const pts = pointsOf(e);
        if (pts.length < 2) return null;
        const mid = pts[Math.floor(pts.length / 2)]!;
        const pos = toPct(mid.x, mid.y);
        return (
          <button
            key={e.id}
            type="button"
            className={`${css.hit}${selectedId === e.id ? ` ${css.hitSelected}` : ""}`}
            style={{ left: pos.left, top: pos.top }}
            title="Select CAD entity to edit vertices"
            aria-label="Select CAD entity"
            onClick={() => setSelectedId(e.id)}
          />
        );
      })}
      {selected
        ? pointsOf(selected).map((p, i) => {
            const pos = toPct(p.x, p.y);
            return (
              <button
                key={`${selected.id}-${i}`}
                type="button"
                className={css.handle}
                style={{ left: pos.left, top: pos.top }}
                data-testid="cad-vertex-handle"
                aria-label={`Vertex ${i + 1}`}
                onPointerDown={(ev) => {
                  ev.stopPropagation();
                  (ev.currentTarget as HTMLElement).setPointerCapture(
                    ev.pointerId,
                  );
                  setDraft(entities.map((e) => ({ ...e })));
                  setDrag({ entityId: selected.id, pointIndex: i });
                }}
              />
            );
          })
        : null}
    </div>
  );
}
