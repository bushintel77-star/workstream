"use client";

import { STUDIO_SITES } from "../../studioCatalog";
import css from "./sites.module.css";

type Props = {
  open: boolean;
  siteIdx: number;
  onClose: () => void;
  onPick: (idx: number) => void;
};

/**
 * Demo lot presets for the handoff board — not the live project list.
 * Switching resets geometry to a canned seed (Wrights / etc.).
 */
export function SiteSwitcher({ open, siteIdx, onClose, onPick }: Props) {
  if (!open) return null;

  return (
    <div
      className={css.panel}
      data-testid="sites-popover"
      role="dialog"
      aria-label="Demo lot presets"
    >
      <div className={css.head}>
        <p className={css.kicker}>Demo lots</p>
        <button type="button" className={css.close} onClick={onClose}>
          Close
        </button>
      </div>
      <p className={css.note}>
        Preset survey seeds for drafting demos — not your project list.
      </p>
      <ul className={css.list}>
        {STUDIO_SITES.map((site, i) => (
          <li key={site.addr}>
            <button
              type="button"
              className={css.row}
              data-active={i === siteIdx ? "true" : "false"}
              onClick={() => {
                onPick(i);
                onClose();
              }}
            >
              <span className={css.addr}>{site.addr}</span>
              <span className={css.meta}>{site.meta}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
