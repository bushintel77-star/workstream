"use client";

import { BY_TYPE, type StudioItem } from "../../studioCatalog";
import css from "./selectionRing.module.css";

type Props = {
  item: StudioItem;
  /** Board-relative % for ring anchor. */
  xPct: number;
  yPct: number;
  locked: boolean;
  onDelete: () => void;
  onClose: () => void;
};

/**
 * Compact selection hub — delete / deselect.
 * Material + peel + lock live on the near-object niche carousel.
 */
export function SelectionRing({
  item,
  xPct,
  yPct,
  locked,
  onDelete,
  onClose,
}: Props) {
  const def = BY_TYPE[item.t];

  return (
    <div
      className={css.ring}
      data-testid="selection-ring"
      data-locked={locked ? "true" : "false"}
      style={{ left: `${xPct}%`, top: `${yPct}%` }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={`${css.node} ${css.west}`}
        title="Delete"
        onClick={onDelete}
      >
        Delete
      </button>

      <button
        type="button"
        className={css.hub}
        title="Deselect"
        onClick={onClose}
      >
        <span className={css.hubTag}>{def.tag}</span>
      </button>
    </div>
  );
}
