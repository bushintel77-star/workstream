"use client";

import { useEffect, useState } from "react";
import type { ResolvedQuoteLine } from "@workstream/domain";
import css from "./quoteBuilder.module.css";

const aud = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

type Props = {
  line: ResolvedQuoteLine;
  compact?: boolean;
  onQty: (n: number) => void;
  onRate: (n: number) => void;
  onNotes: (s: string) => void;
  onExclude: (v: boolean) => void;
  onProvisional: (v: boolean) => void;
  onAlternateSelect: (v: boolean) => void;
  onReset: () => void;
};

export function QuoteLineRow({
  line,
  compact = false,
  onQty,
  onRate,
  onNotes,
  onExclude,
  onProvisional,
  onAlternateSelect,
  onReset,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const struck = line.excluded || (line.is_alternate && !line.alternate_selected);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const badges = (
    <>
      {line.is_provisional ? (
        <span className={`${css.lineBadge} ${css.lineBadgeProv}`}>Provisional</span>
      ) : null}
      {line.is_alternate ? (
        <span className={`${css.lineBadge} ${css.lineBadgeAlt}`}>
          {line.alternate_selected ? "Alt selected" : "Alternate"}
        </span>
      ) : null}
      {line.is_custom ? (
        <span className={`${css.lineBadge} ${css.lineBadgeCustom}`}>Custom</span>
      ) : null}
      {line.excluded ? (
        <span className={`${css.lineBadge} ${css.lineBadgeExcluded}`}>Excluded</span>
      ) : null}
      {line.overridden ? (
        <span className={`${css.lineBadge} ${css.lineBadgeEdited}`}>Edited</span>
      ) : null}
    </>
  );

  const actionChips = (size: "sm" | "md" = "md") => (
    <div className={css.lineActionChips} data-size={size}>
      <button
        type="button"
        className={`${css.lineActionChip}${line.excluded ? ` ${css.lineActionChipActive}` : ""}`}
        onClick={() => onExclude(!line.excluded)}
      >
        {line.excluded ? "Include" : "Exclude"}
      </button>
      <button
        type="button"
        className={`${css.lineActionChip}${line.is_provisional ? ` ${css.lineActionChipActive}` : ""}`}
        onClick={() => onProvisional(!line.is_provisional)}
      >
        Provisional
      </button>
      {line.is_alternate ? (
        <button
          type="button"
          className={`${css.lineActionChip}${line.alternate_selected ? ` ${css.lineActionChipActive}` : ""}`}
          onClick={() => onAlternateSelect(!line.alternate_selected)}
        >
          {line.alternate_selected ? "Deselect" : "Select alt"}
        </button>
      ) : null}
      {line.overridden ? (
        <button type="button" className={css.lineActionChip} onClick={onReset}>
          Reset
        </button>
      ) : null}
    </div>
  );

  if (compact) {
    return (
      <div
        className={`${css.row} ${css.rowCompact}`}
        role="row"
        data-testid={`quote-line-${line.id}`}
      >
        <div className={css.lineCell} role="cell">
          <button
            type="button"
            className={css.mobileLineBtn}
            onClick={() => setDrawerOpen((v) => !v)}
            aria-expanded={drawerOpen}
          >
            <span className={css.mobileLineMain}>
              <span className={css.lineName}>{line.label}</span>
              <span className={css.lineMeta}>
                {line.qty} {line.unit} {line.rate > 0 ? `@ ${aud.format(line.rate)}` : ""}
              </span>
              <span className={css.mobileLineBadges}>{badges}</span>
            </span>
            <span className={css.lineTotal}>{aud.format(line.totalAfterMargin)}</span>
          </button>
        </div>
        {drawerOpen ? (
          <div className={`${css.lineCell} ${css.lineCellDrawer}`} role="cell">
            <div
              className={css.editDrawer}
              data-testid="quote-line-drawer"
            >
              <div className={css.drawerFields}>
                <label>
                  <span className={css.drawerFieldLabel}>Qty</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={line.qty}
                    className={`${css.lineInput} ${css.lineInputNum}`}
                    onChange={(e) => onQty(Number(e.target.value) || 0)}
                  />
                </label>
                <label>
                  <span className={css.drawerFieldLabel}>Rate</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={line.rate}
                    className={`${css.lineInput} ${css.lineInputNum}`}
                    onChange={(e) => onRate(Number(e.target.value) || 0)}
                  />
                </label>
                <label>
                  <span className={css.drawerFieldLabel}>Notes</span>
                  <input
                    type="text"
                    value={line.notes ?? ""}
                    className={`${css.lineInput} ${css.lineInputNotes}`}
                    placeholder="Add a note…"
                    onChange={(e) => onNotes(e.target.value)}
                  />
                </label>
              </div>
              {actionChips("md")}
              <button
                type="button"
                className={css.drawerDone}
                onClick={() => setDrawerOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`${css.row}${struck ? ` ${css.rowStruck}` : ""}`}
      role="row"
      data-testid={`quote-line-${line.id}`}
      style={{ position: "relative" }}
    >
      <div className={`${css.lineCell} ${css.lineCellLabel}`} role="rowheader">
        <span className={css.lineName}>{line.label}</span>
        {line.is_provisional || line.is_alternate || line.is_custom || line.excluded || line.overridden ? (
          <span className={css.lineBadges}>{badges}</span>
        ) : null}
      </div>
      <div className={`${css.lineCell} ${css.lineCellUnit}`} role="cell">
        {line.unit}
      </div>
      <div className={`${css.lineCell} ${css.lineCellQty}`} role="cell">
        <input
          type="number"
          inputMode="decimal"
          value={line.qty}
          aria-label={`${line.label} quantity`}
          className={`${css.lineInput} ${css.lineInputNum}`}
          onChange={(e) => onQty(Number(e.target.value) || 0)}
        />
      </div>
      <div className={`${css.lineCell} ${css.lineCellRate}`} role="cell">
        <input
          type="number"
          inputMode="decimal"
          value={line.rate}
          aria-label={`${line.label} rate`}
          className={`${css.lineInput} ${css.lineInputNum}`}
          onChange={(e) => onRate(Number(e.target.value) || 0)}
        />
      </div>
      <div className={`${css.lineCell} ${css.lineCellTotal} ${css.mono}`} role="cell">
        {aud.format(line.totalAfterMargin)}
      </div>
      <div className={`${css.lineCell} ${css.lineCellActions}`} role="cell">
        <div className={css.rowActions}>
          <button
            type="button"
            className={css.rowMenuBtn}
            aria-label="Line actions"
            data-testid={`quote-line-menu-${line.id}`}
            onClick={() => setDrawerOpen((v) => !v)}
          >
            ⋯
          </button>
        </div>
      </div>
      {drawerOpen ? (
        <div className={css.rowPopover} data-testid="quote-line-popover">
          <input
            type="text"
            value={line.notes ?? ""}
            placeholder="Add a note…"
            aria-label={`${line.label} notes`}
            className={`${css.lineInput} ${css.lineInputNotes}`}
            onChange={(e) => onNotes(e.target.value)}
          />
          {actionChips("sm")}
          <button
            type="button"
            className={css.lineActionChip}
            onClick={() => setDrawerOpen(false)}
          >
            Done
          </button>
        </div>
      ) : null}
    </div>
  );
}
