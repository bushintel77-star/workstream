"use client";

import { MetaIcon } from "./MetaIcon";
import type { TreesLiveMeta } from "./treesLiveMeta";
import css from "./metaPanel.module.css";

type Props = {
  open: boolean;
  meta: TreesLiveMeta;
  onClose: () => void;
};

/**
 * Expanded Trees lane — existing / protected survey trees with RL-style
 * metrics (approx x,y, DBH, indicative AS 4970 TPZ radius). Blush frost body.
 */
export function TreesMetaPanel({ open, meta, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      className={css.panel}
      data-testid="trees-meta-panel"
      role="dialog"
      aria-label="Existing trees"
    >
      <div className={css.head}>
        <div className={css.headMain}>
          <span className={css.headIcon}>
            <MetaIcon id="trees" size={20} />
          </span>
          <div>
            <p className={css.kicker}>Vegetation · survey</p>
            <p className={css.title}>Existing trees</p>
          </div>
        </div>
        <button type="button" className={css.close} onClick={onClose}>
          Close
        </button>
      </div>

      <p className={css.live} data-testid="trees-meta-panel-live">
        <span className={css.metric}>{meta.count}</span>
        <span>
          existing · {meta.tpzCount} with DBH → indicative TPZ (AS 4970)
        </span>
      </p>

      {meta.count === 0 ? (
        <p className={css.empty} data-testid="trees-meta-panel-empty">
          No existing trees marked. Use the Exist tool in Survey to place
          protected / retained trees and set DBH for TPZ rings.
        </p>
      ) : (
        <ul className={css.list} data-testid="trees-meta-panel-list">
          {meta.trees.map((tree, i) => (
            <li key={tree.id}>
              <div className={css.row} data-testid="trees-meta-panel-row">
                <span className={css.rowLabel}>
                  <MetaIcon id="trees" size={14} />
                  Tree {i + 1}
                </span>
                <span className={css.rowMetric}>
                  x{tree.x.toFixed(0)} · y{tree.y.toFixed(0)}
                  {"\u00A0"}
                  {tree.dbhM != null ? (
                    <>
                      · DBH {(tree.dbhM * 1000).toFixed(0)} mm ·{" "}
                      <b>TPZ {tree.tpzRadiusM?.toFixed(1)} m</b>
                    </>
                  ) : (
                    " · DBH —"
                  )}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className={css.honesty} data-testid="trees-meta-panel-honesty">
        TPZ is indicative AS 4970 (12 × DBH, min 2 m) — not an arborist report.
        Confirm SRZ / retention value on site.
      </p>

      <p className={css.foot}>
        Sticky card stays until you dismiss it. Positions are board-% approx.
      </p>
    </div>
  );
}
