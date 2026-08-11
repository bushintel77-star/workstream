"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  DESIGN_LIFECYCLE_LABEL,
  DESIGN_LIFECYCLE_PHASES,
  resolvePhaseCapabilities,
  type DesignLifecyclePhase,
} from "@workstream/domain";
import { CameraChrome } from "../../CameraChrome";
import css from "./phaseManager.module.css";

type MenuStyle = {
  top: number;
  left: number;
};

/** Short labels for the trigger; full names live in the menu item title. */
const PHASE_SHORT: Record<DesignLifecyclePhase, string> = {
  concept: "Concept",
  design_development: "Design",
  construction_docs: "Docs",
  tendering: "Tender",
  construction_admin: "Admin",
  post_occupancy: "Occupancy",
};

type Props = {
  phase: DesignLifecyclePhase;
  onPhase: (phase: DesignLifecyclePhase) => void;
};

/**
 * Header-embedded lifecycle phase dropdown.
 *
 * Sits in the Tier1TopBar left zone alongside brand/address/meta — it is a
 * project-level setting, not a canvas tool, so it belongs with identity, not
 * floating over the drawing. Compact trigger opens a portaled menu of phase
 * chips; the active phase shows on the trigger itself.
 */
export function HeaderPhaseSelect({ phase, onPhase }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);
  const [menuStyle, setMenuStyle] = useState<MenuStyle | null>(null);
  const caps = resolvePhaseCapabilities(phase);

  useLayoutEffect(() => {
    if (open) activeItemRef.current?.focus();
  }, [open]);

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
      left: t.left - b.left,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const menu = open ? (
    <div
      ref={menuRef}
      className={css.menu}
      role="menu"
      id="phase-manager-menu"
      aria-label="Design lifecycle phase"
      data-testid="phase-manager-select"
      style={
        menuStyle
          ? {
              top: menuStyle.top,
              left: menuStyle.left,
            }
          : undefined
      }
    >
      {DESIGN_LIFECYCLE_PHASES.map((p) => {
        const on = p === phase;
        return (
          <button
            key={p}
            ref={on ? activeItemRef : undefined}
            type="button"
            role="menuitemradio"
            aria-checked={on}
            className={`${css.phaseItem}${on ? ` ${css.phaseItemActive}` : ""}`}
            data-on={on ? "1" : "0"}
            data-testid={`phase-chip-${p}`}
            title={DESIGN_LIFECYCLE_LABEL[p]}
            onClick={() => {
              onPhase(p);
              setOpen(false);
              triggerRef.current?.focus();
            }}
          >
            {PHASE_SHORT[p]}
          </button>
        );
      })}
      <p className={css.menuTip}>{caps.tip}</p>
    </div>
  ) : null;

  return (
    <div className={css.headerWrap}>
      <button
        ref={triggerRef}
        type="button"
        className={`${css.headerTrigger}${open ? ` ${css.headerTriggerActive}` : ""}`}
        data-testid="phase-manager-toggle"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="phase-manager-menu"
        title={`Design lifecycle phase — ${DESIGN_LIFECYCLE_LABEL[phase]}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={css.headerLabel}>Lifecycle</span>
        <span className={css.headerValue}>{PHASE_SHORT[phase]}</span>
      </button>
      {menu ? (
        <CameraChrome
          place={{ kind: "dock" }}
          zIndex={55}
          testId="phase-manager-portal"
        >
          {menu}
        </CameraChrome>
      ) : null}
    </div>
  );
}
