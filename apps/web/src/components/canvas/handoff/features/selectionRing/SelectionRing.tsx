"use client";

import { BY_TYPE, type StudioItem, type StudioItemType } from "../../studioCatalog";
import css from "./selectionRing.module.css";

const MATERIALS: StudioItemType[] = [
  "paving",
  "deck",
  "lawn",
  "bed",
  "hedge",
  "canopy",
  "feature",
  "frenchdrain",
];

type Props = {
  item: StudioItem;
  /** Board-relative % for ring anchor. */
  xPct: number;
  yPct: number;
  locked: boolean;
  onMaterial: (t: StudioItemType) => void;
  onOpacityPeel: () => void;
  onParchmentPeel?: () => void;
  onToggleLock: () => void;
  onDelete: () => void;
  onClose: () => void;
};

/**
 * Contextual canvas ring — radial micro-UI under the selection, zero sidebar.
 */
export function SelectionRing({
  item,
  xPct,
  yPct,
  locked,
  onMaterial,
  onOpacityPeel,
  onParchmentPeel,
  onToggleLock,
  onDelete,
  onClose,
}: Props) {
  const def = BY_TYPE[item.t];

  return (
    <div
      className={css.ring}
      data-testid="selection-ring"
      style={{ left: `${xPct}%`, top: `${yPct}%` }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={`${css.node} ${css.north}`}
        title="Material"
        aria-label="Change material"
        onClick={() => {
          const idx = MATERIALS.indexOf(item.t);
          const next = MATERIALS[(idx + 1) % MATERIALS.length]!;
          onMaterial(next);
        }}
      >
        <span className={css.nodeKicker}>Material</span>
        <span className={css.nodeVal}>{def.tag}</span>
      </button>

      <button
        type="button"
        className={`${css.node} ${css.east}`}
        title={onParchmentPeel ? "Parchment peel" : "Layer opacity peel"}
        onClick={onParchmentPeel ?? onOpacityPeel}
      >
        Peel
      </button>

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
        className={`${css.node} ${css.south}`}
        title="Constraint lock"
        onClick={onToggleLock}
      >
        {locked ? "Unlock" : "Lock"}
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
