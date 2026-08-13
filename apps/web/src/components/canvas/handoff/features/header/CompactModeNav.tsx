"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MODE_LABELS, type StudioMode } from "../../studioCatalog";
import css from "./compactModeNav.module.css";

type ModeTab = StudioMode;

type Props = {
  modes: readonly ModeTab[];
  current: ModeTab;
  lockReasonForMode: (mode: ModeTab) => string | null;
  onRequestMode: (mode: ModeTab) => void;
};

/**
 * Compact header mode strip — current mode + overflow tray for the rest.
 * Avoids a second ribbon; keeps ribbon budget for tertiary tools elsewhere.
 */
export function CompactModeNav({
  modes,
  current,
  lockReasonForMode,
  onRequestMode,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open]);

  const others = modes.filter((m) => m !== current);

  return (
    <div className={css.root} ref={rootRef} data-testid="canvas-mode-strip">
      <button
        type="button"
        className={`${css.current} ${css.currentOn}`}
        data-testid={`canvas-mode-${current}`}
        aria-current="page"
        aria-keyshortcuts={String(modes.indexOf(current) + 1)}
        title={`${MODE_LABELS[current]} mode`}
        onClick={() => setOpen(false)}
      >
        {MODE_LABELS[current]}
      </button>
      <button
        type="button"
        className={css.more}
        aria-label="More workflow modes"
        aria-expanded={open}
        aria-controls={menuId}
        data-testid="canvas-mode-overflow"
        onClick={() => setOpen((v) => !v)}
      >
        ···
      </button>
      {open ? (
        <div
          id={menuId}
          className={css.menu}
          role="list"
          aria-label="Workflow modes"
          data-testid="canvas-mode-menu"
        >
          {others.map((m) => {
            const lockReason = lockReasonForMode(m);
            const locked = Boolean(lockReason);
            return (
              <button
                key={m}
                type="button"
                className={css.menuItem}
                data-testid={`canvas-mode-${m}`}
                disabled={locked}
                aria-disabled={locked}
                title={lockReason ?? `${MODE_LABELS[m]} mode`}
                onClick={() => {
                  if (locked) return;
                  onRequestMode(m);
                  setOpen(false);
                }}
              >
                {MODE_LABELS[m]}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
