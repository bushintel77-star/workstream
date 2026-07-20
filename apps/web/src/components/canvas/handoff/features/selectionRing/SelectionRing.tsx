"use client";

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
 * Compact selection hub at the prime pixel — delete / lock / deselect / Ask AI.
 * Material families share the place kit fan (bag progressive disclosure).
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

      {onLock ? (
        <button
          type="button"
          className={`${css.node} ${css.north}`}
          data-testid="selection-lock"
          title={locked ? "Unlock" : "Lock"}
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
          onClick={onAskAi}
        >
          Ask AI
        </button>
      ) : null}

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
