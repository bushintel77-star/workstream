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
 * Renders presentation widgets into a Fit-sheet slot (side / footer / title).
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
    >
      {widgets.map((w) => (
        <WidgetCard
          key={w.id}
          widget={w}
          quoteTotalInclGst={quoteTotalInclGst}
          tier1={tier1}
          context={context}
        />
      ))}
    </div>
  );
}

function WidgetCard({
  widget,
  quoteTotalInclGst,
  tier1,
  context,
}: {
  widget: PresentationWidget;
  quoteTotalInclGst: number;
  tier1: boolean;
  context: SheetWidgetContext | null;
}) {
  if (widget.type === "savings_ledger" && !tier1) {
    return (
      <div
        className={css.sheetWidget}
        data-testid={`sheet-on-${widget.type}`}
        data-accent={widget.style.accent}
        data-emphasis={widget.style.emphasis}
      >
        <p className={css.sheetLabel}>Value reallocation</p>
        <p className={css.sheetValue}>Not available</p>
        <p className={css.sheetDetail}>
          Wrights Terrace proposal ledger — open a Tier-1 site
        </p>
      </div>
    );
  }

  return (
    <div
      className={css.sheetWidget}
      data-testid={`sheet-on-${widget.type}`}
      data-accent={widget.style.accent}
      data-emphasis={widget.style.emphasis}
    >
      {renderBody(widget, quoteTotalInclGst, tier1, context)}
    </div>
  );
}

function renderBody(
  widget: PresentationWidget,
  quoteTotalInclGst: number,
  tier1: boolean,
  context: SheetWidgetContext | null,
) {
  switch (widget.type) {
    case "quote_total":
      return (
        <>
          <p className={css.sheetLabel}>Indicative quote</p>
          <p className={css.sheetValue}>
            {quoteTotalInclGst > 0
              ? aud0(quoteTotalInclGst)
              : "Nothing costed yet"}
          </p>
          <p className={css.sheetDetail}>Incl. GST · live BOM on this drawing</p>
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
            {tier1 ? " · Wrights Terrace demo" : ""}
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
            {context?.zoneDetail ?? "Structure first, then mass planting"}
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
          ) : (
            <div className={css.swatchRow} aria-hidden data-empty="1">
              <span className={`${css.mat} ${css.matEmpty}`} />
              <span className={`${css.mat} ${css.matEmpty}`} />
              <span className={`${css.mat} ${css.matEmpty}`} />
            </div>
          )}
          <p className={css.sheetDetail} data-testid="sheet-mat-labels">
            {widget.text?.trim() ||
              context?.materialLabels ||
              "Place materials on the drawing"}
          </p>
        </>
      );
    case "caption":
      return (
        <>
          <p className={css.sheetLabel}>Presentation</p>
          <p className={css.sheetValue}>
            {widget.text ?? "Concept presentation — Curtis & Co"}
          </p>
        </>
      );
    case "honesty_footer":
      return (
        <>
          <p className={css.sheetLabel}>Honesty</p>
          <p className={css.sheetDetail}>
            {widget.text ??
              "Working drawing — indicative only. Not for construction."}
          </p>
        </>
      );
    default:
      return null;
  }
}
