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
import { modeLockAction } from "../../../lib/modeLockCopy";
import { Button } from "./Button";

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

/** Mode icons — one per canvas mode, the Windows 11 nested-icon pattern. */
const MODE_ICON: Record<string, string> = {
  survey: "⌖",
  sketch: "✎",
  cad: "⌗",
  elevation: "⌐",
  garden: "❀",
  quote: "$",
  present: "◉",
  share: "⤴",
};

/** Entity icons for the inspector's history rail. */
export const ENTITY_ICON: Record<string, string> = {
  placement: "♣",
  feature: "◆",
  boundary: "◇",
  building: "■",
  photoStroke: "✎",
};

const chipBase: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: "var(--gs-font-sm)",
  letterSpacing: "0.04em",
  padding: "3px 9px",
  borderRadius: "var(--gs-radius-pill)",
  border: "1px solid transparent",
  whiteSpace: "nowrap",
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--gs-space-2)",
};

export function PerimeterTabStrip({
  activeMode,
  unlocked,
  onNativeMode,
  metaTabs,
  surveyProgress,
  trailing,
}: {
  activeMode: CanvasMode;
  unlocked: ReadonlySet<CanvasMode>;
  onNativeMode: (mode: CanvasMode) => void;
  metaTabs: MetaTabDef[];
  /**
   * Site-capture progress, shown only while the survey is incomplete. Reads
   * the same derivation as the Survey setup panel (`surveySetup.ts`), so the
   * two can never disagree on the count. Omit once complete — a permanent
   * "5/5" is chrome with nothing left to say.
   */
  surveyProgress?: { done: number; total: number } | null;
  /** Status cell: live stats + save chip + measure readout. */
  trailing?: ReactNode;
}) {
  const glassSegment: CSSProperties = {
    /* Frosted-glass pill (DESIGN.md §5) — backdrop blur on the floating nav. */
    display: "flex",
    alignItems: "center",
    gap: "var(--gs-space-1)",
    padding: "3px 6px",
    borderRadius: "var(--gs-radius-pill)",
    background: "color-mix(in srgb, var(--la-surface) 80%, transparent)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid var(--la-surface-muted)",
    whiteSpace: "nowrap",
  };

  return (
    <div
      data-testid="perimeter-tab-strip"
      aria-label="Canvas tabs"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--gs-space-2)",
        pointerEvents: "auto",
        maxWidth: "100%",
      }}
    >
      <nav
        data-gs-glass-card
        data-testid="studio-mode-tabs"
        aria-label="Studio modes"
        style={{ ...glassSegment, flex: "0 0 auto" }}
      >
        {CANVAS_MODES.map(({ id, label }) => {
          const locked = !unlocked.has(id);
          const active = id === activeMode && !locked;

          if (locked) {
            const lock = modeLockAction(id, unlocked);
            return (
              <button
                key={id}
                type="button"
                data-testid={`mode-tab-${id}`}
                aria-disabled="true"
                aria-label={`${label} locked: ${lock?.reason ?? "Complete the previous stage first."}`}
                title={`${lock?.reason ?? "Complete the previous stage first."} ${lock?.actionLabel ?? ""}`}
                onClick={() => lock && onNativeMode(lock.destination)}
                style={{
                  ...chipBase,
                  color: "var(--gs-ink-secondary)",
                  border: "1px solid var(--gs-line-soft)",
                  cursor: "help",
                  background: "transparent",
                }}
              >
                <span style={{ fontSize: "1.1em", marginRight: 3, opacity: 0.6 }}>
                  {MODE_ICON[id] ?? "·"}
                </span>
                {label}
              </button>
            );
          }

          return (
            <Button
              key={id}
              data-testid={`mode-tab-${id}`}
              aria-label={`Mode ${label}`}
              onClick={() => onNativeMode(id)}
              active={active}
            >
              <span style={{ fontSize: "1.1em", marginRight: 3, opacity: active ? 1 : 0.5 }}>
                {MODE_ICON[id] ?? "·"}
              </span>
              {label}
            </Button>
          );
        })}
      </nav>

      <div
        data-gs-glass-card
        role="group"
        aria-label="Canvas surfaces"
        style={{ ...glassSegment, flex: "0 0 auto" }}
      >
        {surveyProgress ? (
          <Button
            data-testid="survey-progress"
            aria-label={`Survey setup ${surveyProgress.done} of ${surveyProgress.total} complete — open Survey`}
            onClick={() => onNativeMode("survey")}
            active={activeMode === "survey"}
            style={{ fontFamily: "var(--font-tech)" }}
          >
            Survey · {surveyProgress.done}/{surveyProgress.total}
          </Button>
        ) : null}
        {metaTabs.map((t) => (
          <Button
            key={t.id}
            data-testid={`meta-tab-${t.id}`}
            aria-pressed={t.active}
            onClick={t.onToggle}
            active={t.active}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {trailing ? (
        <div
          data-gs-glass-card
          role="status"
          aria-label="Canvas state"
          style={{ ...glassSegment, gap: "var(--gs-space-4)", flex: "0 0 auto" }}
        >
          {trailing}
        </div>
      ) : null}
    </div>
  );
}
