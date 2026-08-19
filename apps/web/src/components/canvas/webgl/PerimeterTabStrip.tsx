"use client";

/**
 * Gold Standard 2026 — Perimeter Tab Strip (2026-08-17 chrome reduction).
 *
 * Operator brief: metadata lives in tabs, not in floating cards. One
 * browser-tab-family chip strip hugs the top edge of the canvas — modes on
 * the left cluster, meta surfaces (Studio / Sun / Growth / Layers / Site /
 * Terrain / Fit) on the right, with the live stats + save chip + measure
 * readout as the trailing status cell. The strip scrolls horizontally and
 * overflows instead of growing; exactly one panel opens beneath it.
 *
 * The 8-mode system is preserved (GOLD-STANDARD-2026-ARCHITECTURE §6):
 * every mode switches natively on the WebGL surface (the legacy SVG board
 * was retired 2026-08-19). Progressive unlock reuses the
 * canvas-mode law (unlockedModes + lockReasonForMode).
 *
 * Contrast/selection vocabulary per TOKENS.md: active chips go charcoal
 * (--gs-chip-active), never accent-hued; the accent stays rare.
 */

import type { CSSProperties, ReactNode } from "react";
import {
  CANVAS_MODES,
  type CanvasMode,
} from "../../../lib/canvas-mode";
import { lockReasonForMode } from "../../../lib/modeLockCopy";

/** Meta surfaces that open as tab panels (Fit rides the store instead). */
export type MetaTabId =
  | "studio"
  | "sun"
  | "growth"
  | "layers"
  | "site"
  | "terrain"
  | "fit";

export interface MetaTabDef {
  id: MetaTabId;
  label: string;
  active: boolean;
  onToggle: () => void;
}

const chipBase: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: 11,
  letterSpacing: "0.04em",
  padding: "3px 9px",
  borderRadius: "var(--gs-radius-pill)",
  border: "1px solid transparent",
  whiteSpace: "nowrap",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};

export function PerimeterTabStrip({
  activeMode,
  unlocked,
  onNativeMode,
  metaTabs,
  trailing,
}: {
  activeMode: CanvasMode;
  unlocked: ReadonlySet<CanvasMode>;
  onNativeMode: (mode: CanvasMode) => void;
  metaTabs: MetaTabDef[];
  /** Status cell: live stats + save chip + measure readout. */
  trailing?: ReactNode;
}) {
  return (
    <div
      data-gs-glass-card
      data-testid="perimeter-tab-strip"
      aria-label="Canvas tabs"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 6px",
        borderRadius: "var(--gs-radius-pill)",
        background: "var(--gs-glass-veil)",
        backdropFilter: "blur(var(--gs-blur))",
        WebkitBackdropFilter: "blur(var(--gs-blur))",
        border: "1px solid color-mix(in srgb, var(--gs-line) 55%, transparent)",
        boxShadow: "var(--gs-shadow-1)",
        pointerEvents: "auto",
        maxWidth: "100%",
        overflowX: "auto",
        scrollbarWidth: "none",
      }}
    >
      <nav
        data-testid="studio-mode-tabs"
        aria-label="Studio modes"
        style={{
          display: "flex",
          gap: 2,
          alignItems: "center",
          flex: "0 0 auto",
        }}
      >
        {CANVAS_MODES.map(({ id, label }) => {
          const locked = !unlocked.has(id);
          const active = id === activeMode && !locked;

          if (locked) {
            const reason = lockReasonForMode(id, unlocked);
            return (
              <span
                key={id}
                data-testid={`mode-tab-${id}`}
                aria-disabled="true"
                title={reason ?? "Locked"}
                style={{
                  ...chipBase,
                  color: "var(--gs-ink-secondary)",
                  border: "1px solid var(--gs-line-soft)",
                  cursor: "not-allowed",
                }}
              >
                {label}
              </span>
            );
          }

          return (
            <button
              key={id}
              type="button"
              data-testid={`mode-tab-${id}`}
              aria-label={`Mode ${label}`}
              onClick={() => onNativeMode(id)}
              style={{
                ...chipBase,
                background: active ? "var(--gs-chip-active)" : "transparent",
                color: active
                  ? "var(--gs-chip-active-ink)"
                  : "var(--gs-ink-secondary)",
                transition: "background 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.color = "var(--gs-ink)";
              }}
              onMouseLeave={(e) => {
                if (!active)
                  e.currentTarget.style.color = "var(--gs-ink-secondary)";
              }}
            >
              {label}
            </button>
          );
        })}
      </nav>

      <div
        aria-hidden
        style={{
          width: 1,
          height: 14,
          background: "color-mix(in srgb, var(--gs-line) 70%, transparent)",
          flex: "0 0 auto",
        }}
      />

      <div
        role="group"
        aria-label="Canvas surfaces"
        style={{
          display: "flex",
          gap: 2,
          alignItems: "center",
          flex: "0 0 auto",
        }}
      >
        {metaTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            data-testid={`meta-tab-${t.id}`}
            aria-pressed={t.active}
            onClick={t.onToggle}
            style={{
              ...chipBase,
              background: t.active ? "var(--gs-chip-active)" : "transparent",
              color: t.active
                ? "var(--gs-chip-active-ink)"
                : "var(--gs-ink-secondary)",
              cursor: "pointer",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!t.active) e.currentTarget.style.color = "var(--gs-ink)";
            }}
            onMouseLeave={(e) => {
              if (!t.active)
                e.currentTarget.style.color = "var(--gs-ink-secondary)";
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {trailing ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginLeft: "auto",
            flex: "0 0 auto",
          }}
        >
          {trailing}
        </div>
      ) : null}
    </div>
  );
}
