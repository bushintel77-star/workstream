"use client";

import { useMemo } from "react";
import { bomLines, type StudioItem } from "../../studioCatalog";
import css from "./bom.module.css";

const MITIGATIONS = [
  {
    id: "tpz",
    label: "TPZ encroachment",
    detail: "Shift deck 0.4 m clear of existing canopy TPZ",
  },
  {
    id: "fall",
    label: "Fall grade",
    detail: "Hold paving fall under 1:100 toward French drain",
  },
] as const;

type Props = {
  items: StudioItem[];
  mitigated: Record<string, boolean>;
  onMitigate: (id: string) => void;
  onOpenQuote: () => void;
  /** Render without absolute dock chrome (utility drawer sheet). */
  embedded?: boolean;
};

const aud = (n: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);

export function LiveBomDock({
  items,
  mitigated,
  onMitigate,
  onOpenQuote,
  embedded = false,
}: Props) {
  const lines = useMemo(() => bomLines(items), [items]);
  const materials = lines.reduce((a, r) => a + r.amt, 0);
  const total = Math.round(materials + 4378); // labour/fees bridge to ~28.5k demo
  const pending = MITIGATIONS.filter((m) => !mitigated[m.id]).length;

  return (
    <aside
      className={`${css.dock}${embedded ? ` ${css.embedded}` : ""}`}
      data-testid="live-bom-hud"
    >
      {!embedded ? (
        <div className={css.head}>
          <p className={css.kicker}>Live BOM / preemptive</p>
          <span className={css.kicker}>{lines.length} lines</span>
        </div>
      ) : (
        <p className={css.kicker}>{lines.length} lines</p>
      )}
      <button type="button" className={css.total} onClick={onOpenQuote}>
        {aud(total)} <span className={css.gst}>incl. GST</span>
      </button>
      <div className={css.lines}>
        {lines.map((row) => (
          <div key={row.name} className={css.line}>
            <span>{row.name}</span>
            <span className={css.amt}>{aud(row.amt)}</span>
          </div>
        ))}
      </div>
      <div className={css.chips}>
        {MITIGATIONS.map((m) => (
          <button
            key={m.id}
            type="button"
            className={css.chip}
            data-on={mitigated[m.id] ? "true" : "false"}
            title={m.detail}
            onClick={() => onMitigate(m.id)}
          >
            {mitigated[m.id] ? "Applied · " : ""}
            {m.label}
          </button>
        ))}
      </div>
      <p className={css.foot}>
        {pending
          ? `${pending} mitigation overlay${pending === 1 ? "" : "s"} ready — click a chip to apply`
          : "All mitigation overlays applied on this drawing"}
      </p>
    </aside>
  );
}
