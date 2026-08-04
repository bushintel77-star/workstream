"use client";

import { KitInput, KitSelect } from "@/components/ui/kit";
import css from "./deckInspectorDock.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  onTitleChange: (title: string) => void;
  deliverableType: string;
  onDeliverableTypeChange: (value: string) => void;
  templateId: string;
  onTemplateIdChange: (value: string) => void;
  palette: string;
  onPaletteChange: (value: string) => void;
  font: string;
  onFontChange: (value: string) => void;
  deliverableOptions: [string, string][];
  templateOptions: [string, string][];
  paletteOptions: [string, string][];
  fontOptions: [string, string][];
};

/**
 * Deck Inspector Dock — summoned right-side panel for deck configuration.
 *
 * Moves the 4 deck config selects (deliverable type, template, palette, font)
 * and the title input out of the PresentSurface toolbar into a collapsible
 * dock with high-contrast dark-slate styling (audit 2.2 / spec §5).
 *
 * The dock is summoned by a "Deck settings" toggle in the slimmed toolbar —
 * it never parks as a fixed opaque bar on the canvas. Per STUDIO-STYLING-AND-UX:
 * "inventory as summoned popup, never a fixed opaque bar on the drawing."
 */
export function DeckInspectorDock({
  open,
  onClose,
  title,
  onTitleChange,
  deliverableType,
  onDeliverableTypeChange,
  templateId,
  onTemplateIdChange,
  palette,
  onPaletteChange,
  font,
  onFontChange,
  deliverableOptions,
  templateOptions,
  paletteOptions,
  fontOptions,
}: Props) {
  if (!open) return null;

  return (
    <div
      className={css.dock}
      data-testid="deck-inspector-dock"
      role="dialog"
      aria-label="Deck settings"
    >
      <div className={css.dockHeader}>
        <span className={css.dockTitle}>Deck settings</span>
        <button
          type="button"
          className={css.dockClose}
          onClick={onClose}
          aria-label="Close deck settings"
          title="Close"
        >
          <svg viewBox="0 0 16 16" fill="none" aria-hidden width="14" height="14">
            <path
              d="M3.5 3.5l9 9M12.5 3.5l-9 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className={css.dockBody}>
        <label className={css.field}>
          <span className={css.fieldLabel}>Title</span>
          <KitInput
            className={css.input}
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Deck title"
            aria-label="Deck title"
          />
        </label>

        <label className={css.field}>
          <span className={css.fieldLabel}>Deliverable</span>
          <KitSelect
            className={css.select}
            value={deliverableType}
            onChange={(e) => onDeliverableTypeChange(e.target.value)}
            aria-label="Deliverable type"
          >
            {deliverableOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </KitSelect>
        </label>

        <label className={css.field}>
          <span className={css.fieldLabel}>Template</span>
          <KitSelect
            className={css.select}
            value={templateId}
            onChange={(e) => onTemplateIdChange(e.target.value)}
            aria-label="Template"
          >
            {templateOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </KitSelect>
        </label>

        <label className={css.field}>
          <span className={css.fieldLabel}>Palette</span>
          <KitSelect
            className={css.select}
            value={palette}
            onChange={(e) => onPaletteChange(e.target.value)}
            aria-label="Palette"
          >
            {paletteOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </KitSelect>
        </label>

        <label className={css.field}>
          <span className={css.fieldLabel}>Font</span>
          <KitSelect
            className={css.select}
            value={font}
            onChange={(e) => onFontChange(e.target.value)}
            aria-label="Font"
          >
            {fontOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </KitSelect>
        </label>
      </div>
    </div>
  );
}
