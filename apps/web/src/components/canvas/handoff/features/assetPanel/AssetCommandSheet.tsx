"use client";

import { useMemo, useState } from "react";
import { CameraChrome } from "../../CameraChrome";
import { BY_TYPE, type StudioItemType, type StudioMode } from "../../studioCatalog";
import { rankAssetCommands } from "./assetCommandRank";
import css from "./assetCommandSheet.module.css";

type SheetMode = "peek" | "expanded";

type Props = {
  open: boolean;
  mode: StudioMode;
  recentAssetTypes: StudioItemType[];
  armed: StudioItemType | null;
  onArm: (t: StudioItemType) => void;
  onClose: () => void;
  onExpandLibrary?: () => void;
  /**
   * Render body only inside StudioSheetHost — no CameraChrome / outer sheet shell.
   */
  embedded?: boolean;
};

/**
 * Mobile asset command sheet — peek row of recents, drag/expand to full library.
 * Single CameraChrome dock slot when standalone (never a second asset floater).
 */
export function AssetCommandSheet({
  open,
  mode,
  recentAssetTypes,
  armed,
  onArm,
  onClose,
  onExpandLibrary,
  embedded = false,
}: Props) {
  const [sheet, setSheet] = useState<SheetMode>(embedded ? "expanded" : "peek");
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

  const body = (
    <>
      <div className={css.peekRow}>
        <p className={css.peekLabel}>Recent · tap to place</p>
        <div className={css.peekChips} role="listbox" aria-label="Recent assets">
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
        {!embedded ? (
          <button
            type="button"
            className={css.close}
            aria-label="Close asset sheet"
            onClick={onClose}
          >
            ×
          </button>
        ) : null}
      </div>

      {sheet === "expanded" || embedded ? (
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
                  onClick={() => {
                    onArm(t);
                    if (!embedded) setSheet("peek");
                  }}
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
          {onExpandLibrary ? (
            <button
              type="button"
              className={css.libraryLink}
              onClick={onExpandLibrary}
            >
              Open full library
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );

  if (embedded) {
    return (
      <div data-testid="asset-command-sheet" data-state="embedded">
        {body}
      </div>
    );
  }

  return (
    <CameraChrome place={{ kind: "dock" }} testId="asset-command-sheet-chrome">
      <aside
        className={`${css.sheet}${sheet === "expanded" ? ` ${css.sheetExpanded}` : ""}`}
        data-testid="asset-command-sheet"
        data-state={sheet}
        aria-label="Asset command sheet"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={css.handle}
          aria-label={
            sheet === "peek" ? "Expand asset library" : "Collapse asset sheet"
          }
          data-testid="asset-command-sheet-handle"
          onClick={() =>
            setSheet((s) => (s === "peek" ? "expanded" : "peek"))
          }
        />
        {body}
      </aside>
    </CameraChrome>
  );
}
