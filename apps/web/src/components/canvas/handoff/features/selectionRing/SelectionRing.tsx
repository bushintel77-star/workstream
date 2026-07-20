"use client";

import type { CSSProperties } from "react";
import { BY_TYPE, type StudioItem } from "../../studioCatalog";
import css from "./selectionRing.module.css";

type Props = {
  item: StudioItem;
  /** Board-relative % for ring anchor (prime pixel). */
  xPct: number;
  yPct: number;
  locked: boolean;
  onDelete: () => void;
  onClose: () => void;
  /** Toggle lock — materials live on the shared kit bag fan. */
  onLock?: () => void;
  /** Open AI collaborator for this selection (sidecar / Cmd+K). */
  onAskAi?: () => void;
};

/**
 * Selection actions orbit the object — never a hub on the glyph itself.
 * Materials live on the shared kit dock (instrument anchor), not here.
 */
export function SelectionRing({
  item,
  xPct,
  yPct,
  locked,
  onDelete,
  onClose,
  onLock,
  onAskAi,
}: Props) {
  const def = BY_TYPE[item.t];
  const half = Math.max(def.w, def.h) * (item.scale || 1) * 0.5;
  /** Clear the glyph footprint — never intersect the selection centre. */
  const orbitPx = Math.max(76, Math.round(half + 40));

  return (
    <div
      className={css.ring}
      data-testid="selection-ring"
      data-locked={locked ? "true" : "false"}
      style={
        {
          left: `${xPct}%`,
          top: `${yPct}%`,
          "--orbit": `${orbitPx}px`,
        } as CSSProperties
      }
    >
      <button
        type="button"
        className={`${css.node} ${css.west}`}
        title="Delete"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onDelete}
      >
        Delete
      </button>

      {onLock ? (
        <button
          type="button"
          className={`${css.node} ${css.north}`}
          data-testid="selection-lock"
          title={locked ? "Unlock" : "Lock"}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onLock}
        >
          {locked ? "Unlock" : "Lock"}
        </button>
      ) : null}

      {onAskAi ? (
        <button
          type="button"
          className={`${css.node} ${css.east}`}
          data-testid="selection-ask-ai"
          title="Ask AI about this selection"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onAskAi}
        >
          Ask AI
        </button>
      ) : null}

      <button
        type="button"
        className={`${css.node} ${css.south} ${css.hubChip}`}
        title="Deselect"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onClose}
      >
        <span className={css.hubTag}>{def.tag}</span>
      </button>
    </div>
  );
}
