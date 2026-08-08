"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { CameraChrome } from "../../CameraChrome";
import css from "./headerViewMenu.module.css";

type MenuStyle = {
  top: number;
  right: number;
};

export type HeaderViewMenuItem = {
  id: string;
  label: string;
  testId?: string;
  active?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  onSelect: () => void;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: HeaderViewMenuItem[];
  /** Shown when any overflow item is active (e.g. dark canvas on). */
  hot?: boolean;
  children?: ReactNode;
};

/**
 * View / More overflow for header tools — keeps primary strip to six controls.
 */
export function HeaderViewMenu({
  open,
  onOpenChange,
  items,
  hot = false,
  children,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<MenuStyle | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const board =
      trigger?.closest('[data-testid="studio-board"]') ??
      document.querySelector('[data-testid="studio-board"]');
    if (!trigger || !(board instanceof HTMLElement)) return;
    const t = trigger.getBoundingClientRect();
    const b = board.getBoundingClientRect();
    setMenuStyle({
      top: t.bottom - b.top + 6,
      right: b.right - t.right,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (
        !wrapRef.current?.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      ) {
        onOpenChange(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  const visible = items.filter((item) => !item.hidden);
  if (visible.length === 0 && !children) return null;

  const menu = open ? (
    <div
      ref={menuRef}
      className={css.menu}
      role="menu"
      data-testid="header-view-menu-panel"
      style={
        menuStyle
          ? {
            top: menuStyle.top,
            right: menuStyle.right,
          }
          : undefined
      }
    >
      {visible.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          className={`${css.item}${item.active ? ` ${css.itemActive}` : ""}`}
          data-testid={item.testId}
          disabled={item.disabled}
          aria-pressed={item.active}
          onClick={() => {
            if (item.disabled) return;
            item.onSelect();
            onOpenChange(false);
          }}
        >
          {item.label}
        </button>
      ))}
      {children}
    </div>
  ) : null;

  return (
    <div className={css.wrap} ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`${css.trigger}${open || hot ? ` ${css.triggerActive}` : ""}`}
        data-testid="header-view-menu"
        aria-label="View and more tools"
        aria-haspopup="menu"
        aria-expanded={open}
        title="View / More"
        onClick={() => onOpenChange(!open)}
      >
        <span className={css.triggerLabel}>View</span>
        <span className={css.triggerMore} aria-hidden>
          ···
        </span>
      </button>
      {menu ? (
        <CameraChrome
          place={{ kind: "dock" }}
          zIndex={55}
          testId="header-view-menu-portal"
        >
          {menu}
        </CameraChrome>
      ) : null}
    </div>
  );
}
