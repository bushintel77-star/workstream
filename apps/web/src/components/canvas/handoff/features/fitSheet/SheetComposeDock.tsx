"use client";

import { useEffect, useRef, useState } from "react";
import type {
  AtmospherePigment,
  PresentationPack,
  PresentationPen,
  PresentationTheme,
  PresentationWidgetType,
} from "@workstream/contracts";
import {
  ATMOSPHERE_PIGMENT_SWATCHES,
  CURTIS_SHEET_TEMPLATES,
  MAX_SHEET_WIDGETS,
  SHEET_PEN_SWATCHES,
  SHEET_THEME_SWATCHES,
  SHEET_WIDGET_LIBRARY,
} from "@workstream/domain";
import css from "./sheetCompose.module.css";
import { Dialog } from "../../../../ui";
import { KitButton } from "../../../../ui/kit";
import { useFocusTrap } from "@/lib/use-focus-trap";

/** Summoned peel dismisses when the operator walks away. */
const COMPOSE_LINGER_MS = 4_200;

type Props = {
  open: boolean;
  onClose: () => void;
  pack: PresentationPack;
  onApplyTemplate: (templateId: string) => void;
  onTheme: (theme: PresentationTheme) => void;
  onPen: (pen: PresentationPen) => void;
  onAtmosphere: (atmosphere: AtmospherePigment) => void;
  onAddWidget: (type: PresentationWidgetType) => void;
  onRemoveWidget: (widgetId: string) => void;
  onReflow: () => void;
  onClear?: () => void;
};

/**
 * Fit-sheet compose — header-summoned frost peel only.
 * No rail, no parked card. Paper stays the product; chrome appears on ask.
 * CameraChrome host (never under zoom-world).
 */
export function SheetComposeDock({
  open,
  onClose,
  pack,
  onApplyTemplate,
  onTheme,
  onPen,
  onAtmosphere,
  onAddWidget,
  onRemoveWidget,
  onReflow,
  onClear,
}: Props) {
  const lingerRef = useRef<number | null>(null);
  const peelRef = useRef<HTMLDivElement>(null);
  const atCap = pack.widgets.length >= MAX_SHEET_WIDGETS;
  const pen = pack.pen ?? "technical";
  const atmosphere = pack.atmosphere ?? "graphite";
  const [pendingTemplate, setPendingTemplate] = useState<string | null>(null);
  const [pendingClear, setPendingClear] = useState(false);

  const bumpLinger = () => {
    if (lingerRef.current != null) window.clearTimeout(lingerRef.current);
    if (!open) return;
    lingerRef.current = window.setTimeout(onClose, COMPOSE_LINGER_MS);
  };

  useEffect(() => {
    if (!open) {
      if (lingerRef.current != null) window.clearTimeout(lingerRef.current);
      return;
    }
    bumpLinger();
    return () => {
      if (lingerRef.current != null) window.clearTimeout(lingerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bumpLinger closes over open/onClose; re-fire only on open toggle
  }, [open]);

  // Esc/trap/autofocus/restore — replaces the bespoke Esc effect. The linger
  // timer resets on pointer activity below; onFocus mirrors that for keyboard
  // nav now that Tab-trap makes keyboard use of this panel real.
  useFocusTrap(open, peelRef, onClose);

  if (!open) return null;

  return (
    <div
      className={css.peelHost}
      data-testid="sheet-compose-dock"
      aria-label="Presentation compose"
      onPointerEnter={() => {
        if (lingerRef.current != null) window.clearTimeout(lingerRef.current);
      }}
      onPointerLeave={bumpLinger}
      onFocus={bumpLinger}
    >
      <div className={css.peel} ref={peelRef} data-testid="sheet-compose-peel" role="dialog">
        <div className={css.peelHead}>
          <p className={css.peelKicker}>Sheet</p>
          <div className={css.peelHeadActions}>
            <button
              type="button"
              className={css.iconAction}
              data-testid="sheet-reflow"
              aria-label="Auto-format"
              title="Auto-format"
              onClick={() => {
                onReflow();
                bumpLinger();
              }}
            >
              <ReflowGlyph />
            </button>
            <button
              type="button"
              className={css.iconAction}
              data-testid="sheet-compose-close"
              aria-label="Close compose"
              title="Close"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </div>

        <div className={css.peelRow}>
          <p className={css.peelKicker}>Theme</p>
          <div
            className={css.themeRow}
            role="radiogroup"
            aria-label="Sheet theme"
            data-testid="sheet-theme-swatches"
          >
            {SHEET_THEME_SWATCHES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                className={css.themeChip}
                data-theme={t.id}
                data-on={pack.theme === t.id ? "1" : "0"}
                data-testid={`sheet-theme-${t.id}`}
                aria-label={t.label}
                aria-checked={pack.theme === t.id}
                title={t.label}
                onClick={() => {
                  onTheme(t.id);
                  bumpLinger();
                }}
              />
            ))}
          </div>
        </div>

        <div className={css.peelRow}>
          <p className={css.peelKicker}>Pen</p>
          <div
            className={css.seedRow}
            role="radiogroup"
            aria-label="Sheet pen"
            data-testid="sheet-pen-swatches"
          >
            {SHEET_PEN_SWATCHES.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                className={css.seedChip}
                data-pen={p.id}
                data-on={pen === p.id ? "1" : "0"}
                data-testid={`sheet-pen-${p.id}`}
                aria-label={p.label}
                aria-checked={pen === p.id}
                title={p.detail}
                onClick={() => {
                  onPen(p.id);
                  bumpLinger();
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className={css.peelRow}>
          <p className={css.peelKicker}>Atmosphere</p>
          <div
            className={css.themeRow}
            role="radiogroup"
            aria-label="Atmosphere palette"
            data-testid="sheet-atmosphere-swatches"
          >
            {ATMOSPHERE_PIGMENT_SWATCHES.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                className={css.atmosphereChip}
                data-atmosphere={a.id}
                data-on={atmosphere === a.id ? "1" : "0"}
                data-testid={`sheet-atmosphere-${a.id}`}
                aria-label={a.label}
                aria-checked={atmosphere === a.id}
                title={a.label}
                style={{ background: a.hex }}
                onClick={() => {
                  onAtmosphere(a.id);
                  bumpLinger();
                }}
              />
            ))}
          </div>
        </div>

        <div className={css.peelRow}>
          <p className={css.peelKicker}>Seed</p>
          <div className={css.seedRow} data-testid="sheet-template-row">
            {CURTIS_SHEET_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                className={css.seedChip}
                data-on={pack.template_id === tpl.id ? "1" : "0"}
                data-testid={`sheet-template-${tpl.id}`}
                aria-pressed={pack.template_id === tpl.id}
                title={tpl.detail}
                onClick={() => {
                  if (
                    pack.widgets.length > 0 &&
                    pack.template_id !== tpl.id
                  ) {
                    setPendingTemplate(tpl.id);
                    return;
                  }
                  onApplyTemplate(tpl.id);
                  bumpLinger();
                }}
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </div>

        <div className={css.peelRow}>
          <p className={css.peelKicker}>Add</p>
          <div className={css.addRow} data-testid="sheet-widget-library">
            {SHEET_WIDGET_LIBRARY.map((w) => {
              const existing = pack.widgets.find((x) => x.type === w.type);
              const singletonTaken = w.type !== "caption" && !!existing;
              const disabled = singletonTaken || (atCap && w.type === "caption");
              return (
                <button
                  key={w.type}
                  type="button"
                  className={css.addChip}
                  data-testid={`sheet-add-${w.type}`}
                  data-on={singletonTaken ? "1" : "0"}
                  title={
                    singletonTaken
                      ? `${w.label} · tap to remove`
                      : atCap
                        ? "Sheet full"
                        : w.detail
                  }
                  disabled={disabled && !singletonTaken}
                  onClick={() => {
                    if (singletonTaken && existing) {
                      onRemoveWidget(existing.id);
                    } else if (!disabled) {
                      onAddWidget(w.type);
                    }
                    bumpLinger();
                  }}
                >
                  {w.label}
                  {singletonTaken ? (
                    <span className={css.addX} aria-hidden>
                      ×
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className={css.peelHint}>
            {pack.widgets.length}/{MAX_SHEET_WIDGETS} on sheet
          </p>
        </div>

        {onClear ? (
          <button
            type="button"
            className={css.clearBtn}
            data-testid="sheet-clear"
            onClick={() => {
              if (pack.widgets.length > 0) {
                setPendingClear(true);
                return;
              }
              onClear();
              bumpLinger();
            }}
          >
            Clear sheet
          </button>
        ) : null}
      </div>

      <Dialog
        open={pendingTemplate != null}
        onClose={() => setPendingTemplate(null)}
        title="Replace sheet?"
        destructive
        footer={
          <>
            <KitButton variant="ghost" size="sm" onClick={() => setPendingTemplate(null)}>
              Cancel
            </KitButton>
            <KitButton
              variant="destructive"
              size="sm"
              onClick={() => {
                if (pendingTemplate) onApplyTemplate(pendingTemplate);
                setPendingTemplate(null);
                bumpLinger();
              }}
            >
              Replace
            </KitButton>
          </>
        }
      >
        <p>Replace the current sheet with a new template? Existing widgets will be cleared.</p>
      </Dialog>

      <Dialog
        open={pendingClear}
        onClose={() => setPendingClear(false)}
        title="Clear widgets?"
        destructive
        footer={
          <>
            <KitButton variant="ghost" size="sm" onClick={() => setPendingClear(false)}>
              Cancel
            </KitButton>
            <KitButton
              variant="destructive"
              size="sm"
              onClick={() => {
                setPendingClear(false);
                onClear?.();
                bumpLinger();
              }}
            >
              Clear
            </KitButton>
          </>
        }
      >
        <p>Clear all presentation widgets from the sheet?</p>
      </Dialog>
    </div>
  );
}

function ReflowGlyph() {
  return (
    <svg className={css.glyph} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3.5 5h6.5M3.5 8h9M3.5 11h5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path
        d="M12 3.5v3M10.5 5 12 3.5 13.5 5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
