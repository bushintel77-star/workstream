"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import s from "./ui.module.css";

type Props = {
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  /** Optional aria-label for the trigger wrapper. */
  label?: string;
};

export function Popover({
  trigger,
  children,
  align = "right",
  label,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={s.popoverRoot}>
      <button
        type="button"
        className={s.popoverTrigger}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
      </button>
      {open ? (
        <div
          id={menuId}
          className={s.popoverMenu}
          data-align={align}
          role="menu"
          onClick={() => setOpen(false)}
          data-testid="popover-menu"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
