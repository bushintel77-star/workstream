"use client";

import type {
  PresentationPack,
  PresentationSlot,
  PresentationTheme,
  PresentationWidgetType,
} from "@workstream/contracts";
import {
  CURTIS_SHEET_TEMPLATES,
  MAX_SHEET_WIDGETS,
  SHEET_THEME_SWATCHES,
  SHEET_WIDGET_LIBRARY,
  widgetsInSlot,
} from "@workstream/domain";
import css from "./sheetCompose.module.css";

const SLOT_LABELS: Record<PresentationSlot, string> = {
  title_meta: "Title meta",
  side_stack: "Side stack",
  footer_band: "Footer band",
};

type Props = {
  pack: PresentationPack;
  onApplyTemplate: (templateId: string) => void;
  onTheme: (theme: PresentationTheme) => void;
  onAddWidget: (type: PresentationWidgetType) => void;
  onMoveWidget: (widgetId: string, slot: PresentationSlot) => void;
  onRemoveWidget: (widgetId: string) => void;
  onReflow: () => void;
  onClear?: () => void;
};

/**
 * Fit-sheet presentation compose — templates, theme swatches, widget library,
 * drag widgets between slots. CameraChrome host (never under zoom-world).
 */
export function SheetComposeDock({
  pack,
  onApplyTemplate,
  onTheme,
  onAddWidget,
  onMoveWidget,
  onRemoveWidget,
  onReflow,
  onClear,
}: Props) {
  const atCap = pack.widgets.length >= MAX_SHEET_WIDGETS;

  return (
    <aside
      className={css.dock}
      data-testid="sheet-compose-dock"
      aria-label="Presentation compose"
    >
      <div className={css.titleRow}>
        <div>
          <p className={css.kicker}>Presentation sheet</p>
          <h2 className={css.title} id="sheet-compose-title">
            Compose
          </h2>
        </div>
        <div className={css.actions}>
          <button
            type="button"
            className={`${css.btn} ${css.btnAccent}`}
            data-testid="sheet-reflow"
            onClick={onReflow}
          >
            Auto-format
          </button>
          {onClear ? (
            <button
              type="button"
              className={css.btn}
              data-testid="sheet-clear"
              onClick={() => {
                if (pack.widgets.length === 0) {
                  onClear();
                  return;
                }
                if (
                  window.confirm(
                    "Clear all presentation widgets from this sheet?",
                  )
                ) {
                  onClear();
                }
              }}
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <div className={css.section}>
        <p className={css.kicker} id="sheet-theme-label">
          Theme
        </p>
        <div
          className={css.swatches}
          data-testid="sheet-theme-swatches"
          role="radiogroup"
          aria-labelledby="sheet-theme-label"
        >
          {SHEET_THEME_SWATCHES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              className={css.swatch}
              data-theme={t.id}
              data-on={pack.theme === t.id ? "1" : "0"}
              data-testid={`sheet-theme-${t.id}`}
              aria-label={t.label}
              aria-checked={pack.theme === t.id}
              title={t.label}
              onClick={() => onTheme(t.id)}
            />
          ))}
        </div>
      </div>

      <div className={css.scroll}>
        <div className={css.section}>
          <p className={css.kicker}>Templates</p>
          {CURTIS_SHEET_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              className={css.tpl}
              data-on={pack.template_id === tpl.id ? "1" : "0"}
              data-testid={`sheet-template-${tpl.id}`}
              aria-pressed={pack.template_id === tpl.id}
              onClick={() => {
                if (
                  pack.widgets.length > 0 &&
                  pack.template_id !== tpl.id &&
                  !window.confirm(
                    `Replace current widgets with “${tpl.label}”?`,
                  )
                ) {
                  return;
                }
                onApplyTemplate(tpl.id);
              }}
            >
              <span className={css.tplName}>{tpl.label}</span>
              <span className={css.tplDetail}>{tpl.detail}</span>
            </button>
          ))}
        </div>

        <div className={css.section}>
          <p className={css.kicker}>Widget library</p>
          <div className={css.chips} data-testid="sheet-widget-library">
            {SHEET_WIDGET_LIBRARY.map((w) => {
              const singletonTaken =
                w.type !== "caption" &&
                pack.widgets.some((x) => x.type === w.type);
              const disabled = singletonTaken || (atCap && w.type === "caption");
              return (
                <button
                  key={w.type}
                  type="button"
                  className={css.chip}
                  data-testid={`sheet-add-${w.type}`}
                  data-on={singletonTaken ? "1" : "0"}
                  title={
                    singletonTaken
                      ? `${w.label} already on sheet`
                      : atCap
                        ? "Sheet widget limit reached"
                        : w.detail
                  }
                  disabled={disabled}
                  aria-disabled={disabled}
                  onClick={() => onAddWidget(w.type)}
                >
                  {w.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className={css.section}>
          <p className={css.kicker}>On sheet · drag between slots</p>
          <div className={css.slots}>
            {(Object.keys(SLOT_LABELS) as PresentationSlot[]).map((slot) => (
              <SlotDrop
                key={slot}
                slot={slot}
                widgets={widgetsInSlot(pack, slot)}
                onMoveWidget={onMoveWidget}
                onRemoveWidget={onRemoveWidget}
              />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

function SlotDrop({
  slot,
  widgets,
  onMoveWidget,
  onRemoveWidget,
}: {
  slot: PresentationSlot;
  widgets: PresentationPack["widgets"];
  onMoveWidget: (widgetId: string, slot: PresentationSlot) => void;
  onRemoveWidget: (widgetId: string) => void;
}) {
  return (
    <div
      className={css.slot}
      data-testid={`sheet-slot-${slot}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.currentTarget.dataset.over = "1";
      }}
      onDragLeave={(e) => {
        e.currentTarget.dataset.over = "0";
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.currentTarget.dataset.over = "0";
        const id = e.dataTransfer.getData("text/sheet-widget");
        if (id) onMoveWidget(id, slot);
      }}
    >
      <p className={css.slotLabel}>{SLOT_LABELS[slot]}</p>
      {widgets.length === 0 ? (
        <p className={css.slotEmpty}>Drop widgets here</p>
      ) : null}
      {widgets.map((w) => (
        <div
          key={w.id}
          className={css.widgetRow}
          draggable
          data-testid={`sheet-widget-chip-${w.type}`}
          onDragStart={(e) => {
            e.dataTransfer.setData("text/sheet-widget", w.id);
            e.dataTransfer.effectAllowed = "move";
          }}
        >
          <span>{labelFor(w.type)}</span>
          <div className={css.widgetActions}>
            <select
              className={css.slotSelect}
              aria-label={`Move ${labelFor(w.type)} to slot`}
              value={slot}
              onChange={(e) =>
                onMoveWidget(w.id, e.target.value as PresentationSlot)
              }
            >
              {(Object.keys(SLOT_LABELS) as PresentationSlot[]).map((s) => (
                <option key={s} value={s}>
                  {SLOT_LABELS[s]}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={css.rm}
              aria-label={`Remove ${labelFor(w.type)}`}
              onClick={() => onRemoveWidget(w.id)}
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function labelFor(type: PresentationWidgetType): string {
  return SHEET_WIDGET_LIBRARY.find((w) => w.type === type)?.label ?? type;
}
