"use client";

import { useState } from "react";
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

  if (compact) {
    return (
      <>
        <tr
          className={`${css.row}${struck ? ` ${css.rowStruck}` : ""}`}
          data-testid={`quote-line-${line.id}`}
        >
          <td>
            <button
              type="button"
              className={css.mobileLineBtn}
              onClick={() => setDrawerOpen(true)}
            >
              <span className={css.lineLabel}>{line.label}</span>
              {line.is_provisional ? (
                <span className={css.provTag}>Provisional</span>
              ) : null}
              <span className={css.mono}>{aud.format(line.totalAfterMargin)}</span>
            </button>
          </td>
        </tr>
        {drawerOpen ? (
          <tr className={css.drawerRow}>
            <td>
              <div className={css.editDrawer} data-testid="quote-line-drawer">
                <label>
                  Qty
                  <input
                    type="number"
                    inputMode="decimal"
                    value={line.qty}
                    onChange={(e) => onQty(Number(e.target.value) || 0)}
                  />
                </label>
                <label>
                  Rate
                  <input
                    type="number"
                    inputMode="decimal"
                    value={line.rate}
                    onChange={(e) => onRate(Number(e.target.value) || 0)}
                  />
                </label>
                <label>
                  Notes
                  <input
                    type="text"
                    value={line.notes ?? ""}
                    onChange={(e) => onNotes(e.target.value)}
                  />
                </label>
                <div className={css.drawerActions}>
                  <button type="button" onClick={() => onExclude(!line.excluded)}>
                    {line.excluded ? "Include" : "Exclude from quote"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onProvisional(!line.is_provisional)}
                  >
                    Provisional
                  </button>
                  {line.is_alternate ? (
                    <button
                      type="button"
                      onClick={() => onAlternateSelect(!line.alternate_selected)}
                    >
                      {line.alternate_selected ? "Deselect alt" : "Select alt"}
                    </button>
                  ) : null}
                  {line.overridden ? (
                    <button type="button" onClick={onReset}>
                      Reset to estimate
                    </button>
                  ) : null}
                  <button type="button" onClick={() => setDrawerOpen(false)}>
                    Done
                  </button>
                </div>
              </div>
            </td>
          </tr>
        ) : null}
      </>
    );
  }

  return (
    <tr
      className={`${css.row}${struck ? ` ${css.rowStruck}` : ""}`}
      data-testid={`quote-line-${line.id}`}
    >
      <th scope="row">
        {line.label}
        {line.is_provisional ? (
          <span className={css.provTag}> Provisional</span>
        ) : null}
      </th>
      <td>{line.unit}</td>
      <td>
        <input
          className={css.num}
          type="number"
          inputMode="decimal"
          value={line.qty}
          aria-label={`${line.label} quantity`}
          onChange={(e) => onQty(Number(e.target.value) || 0)}
        />
      </td>
      <td>
        <input
          className={css.num}
          type="number"
          inputMode="decimal"
          value={line.rate}
          aria-label={`${line.label} rate`}
          onChange={(e) => onRate(Number(e.target.value) || 0)}
        />
      </td>
      <td className={css.mono}>{aud.format(line.totalAfterMargin)}</td>
      <td>
        <div className={css.overflow}>
          <button type="button" onClick={() => onExclude(!line.excluded)}>
            {line.excluded ? "Include" : "Exclude from quote"}
          </button>
          <button type="button" onClick={() => onProvisional(!line.is_provisional)}>
            Provisional
          </button>
          {line.is_alternate ? (
            <button
              type="button"
              onClick={() => onAlternateSelect(!line.alternate_selected)}
            >
              {line.alternate_selected ? "Deselect alt" : "Select alt"}
            </button>
          ) : null}
          {line.overridden ? (
            <button type="button" onClick={onReset}>
              Reset to estimate
            </button>
          ) : null}
          <input
            className={css.notes}
            type="text"
            placeholder="Notes"
            value={line.notes ?? ""}
            onChange={(e) => onNotes(e.target.value)}
            aria-label={`${line.label} notes`}
          />
        </div>
      </td>
    </tr>
  );
}
