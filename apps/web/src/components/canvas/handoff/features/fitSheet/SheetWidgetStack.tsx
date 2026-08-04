"use client";

import type { PresentationPack, PresentationWidget } from "@workstream/contracts";
import { TIER1_WRIGHTS_SAVINGS, widgetsInSlot } from "@workstream/domain";
import type { SheetWidgetContext } from "./sheetWidgetContext";
import css from "./sheetCompose.module.css";

type Props = {
  pack: PresentationPack;
  slot: "title_meta" | "side_stack" | "footer_band";
  quoteTotalInclGst?: number;
  tier1?: boolean;
  context?: SheetWidgetContext | null;
  className?: string;
};

const aud0 = (n: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);

/**
 * Paper-ink presentation widgets — quiet faces inside the Fit schedule panel.
 * No frosted chrome cards; the drawing / title block stay primary.
 */
export function SheetWidgetStack({
  pack,
  slot,
  quoteTotalInclGst = 0,
  tier1 = false,
  context = null,
  className,
}: Props) {
  const widgets = widgetsInSlot(pack, slot);
  if (widgets.length === 0) return null;
  return (
    <div
      className={`${slot === "footer_band" ? css.band : ""} ${className ?? ""}`}
      data-testid={`sheet-widgets-${slot}`}
      data-theme={pack.theme}
      data-slot={slot}
    >
      {widgets.map((w) => (
        <WidgetFace
          key={w.id}
          widget={w}
          slot={slot}
          quoteTotalInclGst={quoteTotalInclGst}
          tier1={tier1}
          context={context}
        />
      ))}
    </div>
  );
}

function WidgetFace({
  widget,
  slot,
  quoteTotalInclGst,
  tier1,
  context,
}: {
  widget: PresentationWidget;
  slot: Props["slot"];
  quoteTotalInclGst: number;
  tier1: boolean;
  context: SheetWidgetContext | null;
}) {
  if (widget.type === "savings_ledger" && !tier1) {
    return null;
  }

  return (
    <div
      className={css.sheetWidget}
      data-testid={`sheet-on-${widget.type}`}
      data-slot={slot}
      data-accent={widget.style.accent}
      data-emphasis={widget.style.emphasis}
    >
      {renderBody(widget, quoteTotalInclGst, tier1, context, slot)}
    </div>
  );
}

function renderBody(
  widget: PresentationWidget,
  quoteTotalInclGst: number,
  tier1: boolean,
  context: SheetWidgetContext | null,
  slot: Props["slot"],
) {
  switch (widget.type) {
    case "quote_total":
      return (
        <>
          {slot !== "title_meta" ? (
            <p className={css.sheetLabel}>Indicative quote</p>
          ) : null}
          <p className={css.sheetValue}>
            {quoteTotalInclGst > 0
              ? aud0(quoteTotalInclGst)
              : "Nothing costed yet"}
          </p>
          {slot === "side_stack" ? (
            <p className={css.sheetDetail}>Incl. GST · live BOM</p>
          ) : null}
        </>
      );
    case "savings_ledger":
      return (
        <>
          <p className={css.sheetLabel}>Proposal ledger</p>
          <p className={css.sheetValue}>
            {aud0(Math.abs(TIER1_WRIGHTS_SAVINGS.net_inc_gst))} save
          </p>
          <p className={css.sheetDetail}>
            Target {aud0(TIER1_WRIGHTS_SAVINGS.target_total_inc_gst)}
            {tier1 ? " · Wrights" : ""}
          </p>
        </>
      );
    case "zone_summary":
      return (
        <>
          <p className={css.sheetLabel}>Massing</p>
          <p className={css.sheetValue} data-testid="sheet-zone-face">
            {widget.text?.trim() ||
              context?.zoneFace ||
              "No zones drawn yet"}
          </p>
          <p className={css.sheetDetail}>
            {context?.zoneDetail ?? "From this drawing"}
          </p>
        </>
      );
    case "material_swatches":
      return (
        <>
          <p className={css.sheetLabel}>Materials</p>
          {context && context.materialChips.length > 0 ? (
            <div className={css.swatchRow} aria-hidden>
              {context.materialChips.map((c) => (
                <span
                  key={c.id}
                  className={css.mat}
                  style={{ background: c.hex }}
                  title={c.label}
                  data-testid={`sheet-mat-${c.id}`}
                />
              ))}
            </div>
          ) : null}
          <p className={css.sheetDetail} data-testid="sheet-mat-labels">
            {widget.text?.trim() ||
              context?.materialLabels ||
              "Place materials on the drawing"}
          </p>
        </>
      );
    case "caption":
      return (
        <p className={css.sheetValue}>
          {widget.text ?? "Concept presentation"}
        </p>
      );
    case "honesty_footer":
      // Legacy packs may still store these — never surface as sheet cards.
      return null;
    default:
      return null;
  }
}
