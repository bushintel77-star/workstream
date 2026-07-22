"use client";

import { useState } from "react";
import type { TradeLineMatch } from "@workstream/domain";
import { CameraChrome } from "../../CameraChrome";
import type { BoardCamera } from "../../geometry/cameraPointer";
import css from "./tradeSkuTag.module.css";

type Props = {
  match: TradeLineMatch;
  xPct: number;
  yPct: number;
  /**
   * Live board camera — SKU cost tag portals out of `.zoomWorld` so the
   * chip and hub-alternatives popup stay at a constant screen size.
   */
  cam?: BoardCamera;
};

const aud = (n: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);

/**
 * Contextual SKU cost tag beside selection — click for hub alternatives.
 */
export function TradeSkuTag({ match, xPct, yPct, cam }: Props) {
  const [open, setOpen] = useState(false);
  const unverified = match.mode === "ai_estimated";
  const oos = !match.offer.inStock;

  const body = (
    <div
      className={css.anchor}
      data-testid="trade-sku-tag"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={`${css.tag}${unverified || oos ? ` ${css.amber}` : ""}`}
        data-testid="trade-sku-tag-btn"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={css.name}>{match.offer.botanicalOrSpec}</span>
        <span className={css.meta}>
          {match.offer.container} · {aud(match.offer.wholesaleExGst)} /{" "}
          {match.offer.unit} ·{" "}
          {match.offer.hubLabel.split("·")[0]?.trim() ?? match.offer.hubLabel}
          {oos ? " · OOS" : ""}
        </span>
      </button>
      {open ? (
        <div className={css.popup} data-testid="trade-sku-alts">
          <p className={css.popupHead}>Trade alternatives</p>
          {match.alternatives.length === 0 ? (
            <p className={css.empty}>No other hub offers in cache</p>
          ) : (
            <ul className={css.list}>
              {match.alternatives.map((a) => (
                <li key={a.sku}>
                  <span className={css.altLabel}>{a.hubLabel}</span>
                  <span className={css.altMeta}>
                    {a.container} · {aud(a.wholesaleExGst)}
                    {!a.inStock ? " · OOS" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className={css.honesty}>
            Cached wholesale — confirm stock before order
          </p>
        </div>
      ) : null}
    </div>
  );

  if (!cam) {
    return (
      <div style={{ position: "absolute", left: `${xPct}%`, top: `${yPct}%` }}>
        {body}
      </div>
    );
  }

  return (
    <CameraChrome
      place={{
        kind: "project",
        pct: { x: xPct, y: yPct },
        cam,
        transform: "none",
      }}
    >
      {body}
    </CameraChrome>
  );
}
