"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import s from "./ui.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Destructive accent — red title bar + danger button styling hint. */
  destructive?: boolean;
};

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  destructive = false,
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

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={s.dialogScrim}
      onClick={onClose}
      data-testid="dialog-scrim"
    >
      <div
        ref={panelRef}
        className={s.dialogPanel}
        data-destructive={destructive ? "1" : "0"}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        data-testid="dialog-panel"
      >
        {title ? (
          <header className={s.dialogHeader}>
            <h2 className={s.dialogTitle}>{title}</h2>
          </header>
        ) : null}
        <div className={s.dialogBody}>{children}</div>
        {footer ? <footer className={s.dialogFooter}>{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
