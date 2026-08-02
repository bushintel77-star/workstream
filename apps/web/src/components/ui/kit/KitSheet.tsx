"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import s from "./kit.module.css";

type Side = "right" | "left" | "bottom";

type Props = {
  open: boolean;
  onClose: () => void;
  side?: Side;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  className?: string;
};

/**
 * shadcn/ui-style Sheet. Slide-over panel with scrim, used for review overlays
 * (ghost review, format review, swatch picker). Animates in from the side.
 */
export function KitSheet({
  open,
  onClose,
  side = "right",
  title,
  children,
  footer,
  width = 340,
  className,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className={s.sheetScrim}
        onClick={onClose}
        data-testid="kit-sheet-scrim"
      />
      <div
        ref={panelRef}
        className={`${s.sheet} ${className ?? ""}`.trim()}
        data-side={side}
        style={side === "right" || side === "left" ? { width } : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        data-testid="kit-sheet"
      >
        {title ? (
          <header className={s.sheetHeader}>
            <h3 className={s.sheetTitle}>{title}</h3>
            <button
              type="button"
              className={s.sheetClose}
              onClick={onClose}
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M1 1l12 12M13 1L1 13"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </header>
        ) : null}
        <div className={s.sheetBody}>{children}</div>
        {footer ? <footer className={s.sheetFooter}>{footer}</footer> : null}
      </div>
    </>
  );
}
