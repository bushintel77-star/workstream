"use client";

import { useMemo, useState } from "react";
import { BY_TYPE, type StudioItemType, type StudioMode } from "../../studioCatalog";
import { rankAssetCommands } from "./assetCommandRank";
import css from "./assetCommandSheet.module.css";

type Props = {
  open: boolean;
  mode: StudioMode;
  recentAssetTypes: StudioItemType[];
  armed: StudioItemType | null;
  onArm: (t: StudioItemType) => void;
  onClose: () => void;
  /** Card variant for desktop pop-out; sheet variant for compact bottom sheet. */
  variant?: "sheet" | "card";
};

/**
 * Compact asset library body — mounted inside StudioSheetHost or a pop-out card.
 * Desktop can use it as a summoned card from the border Add icon.
 */
export function AssetCommandSheet({
  open,
  mode,
  recentAssetTypes,
  armed,
  onArm,
  onClose,
  variant = "sheet",
}: Props) {
  const [query, setQuery] = useState("");

  const ranked = useMemo(
    () =>
      rankAssetCommands({
        query,
        recents: recentAssetTypes,
        mode,
      }),
    [query, recentAssetTypes, mode],
  );

  const peekTypes = useMemo(() => {
    const fromRecents = recentAssetTypes.filter((t) => !BY_TYPE[t].existing);
    if (fromRecents.length > 0) return fromRecents.slice(0, 5);
    return ranked.slice(0, 5);
  }, [recentAssetTypes, ranked]);

  if (!open) return null;

  return (
    <div
      data-testid="asset-command-sheet"
      data-state={variant === "card" ? "card" : "embedded"}
      className={variant === "card" ? css.card : undefined}
    >
      <div className={css.peekRow}>
        <p className={css.peekLabel}>Recent · tap to place</p>
        <div
          className={css.peekChips}
          role="listbox"
          aria-label="Recent assets"
          data-testid="asset-swatch-row"
        >
          {peekTypes.map((t) => (
            <button
              key={t}
              type="button"
              role="option"
              aria-selected={armed === t}
              className={`${css.chip}${armed === t ? ` ${css.chipOn}` : ""}`}
              data-testid={`asset-sheet-recent-${t}`}
              onClick={() => onArm(t)}
            >
              {BY_TYPE[t].tag}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={css.close}
          aria-label="Close asset sheet"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className={css.body}>
        <input
          type="search"
          className={css.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search assets — type to place"
          aria-label="Search assets"
          data-testid="asset-command-sheet-search"
        />
        <ul className={css.list} role="listbox" aria-label="Asset results">
          {ranked.map((t) => (
            <li key={t}>
              <button
                type="button"
                role="option"
                aria-selected={armed === t}
                className={css.row}
                data-testid={`asset-sheet-place-${t}`}
                onClick={() => onArm(t)}
              >
                <span className={css.rowLabel}>{BY_TYPE[t].name}</span>
                <span className={css.rowMeta}>{BY_TYPE[t].tag}</span>
              </button>
            </li>
          ))}
          {ranked.length === 0 ? (
            <li className={css.empty}>No matching assets</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
