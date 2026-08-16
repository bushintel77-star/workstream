"use client";

/**
 * Gold Standard 2026 — Studio Mode Tabs (top-centre glass pill row).
 *
 * The URL-driven 8-mode system (survey|sketch|cad|elevation|garden|quote|
 * present|share) is preserved per GOLD-STANDARD-2026-ARCHITECTURE §6.
 * The WebGL studio implements sketch/quote/present natively; the modes the
 * classic SVG board still owns open it in that mode — so every mode is one
 * click away and no deep link dead-ends. Progressive unlock reuses the
 * canvas-mode law (unlockedModes + lockReasonForMode).
 */

import {
  CANVAS_MODES,
  webglStudioSupportsMode,
  type CanvasMode,
} from "../../../lib/canvas-mode";
import { lockReasonForMode } from "../../../lib/modeLockCopy";

export type NativeWebGLMode = Extract<
  CanvasMode,
  "sketch" | "quote" | "present" | "elevation" | "garden"
>;

export function isNativeWebGLMode(mode: CanvasMode): mode is NativeWebGLMode {
  return webglStudioSupportsMode(mode);
}

export function StudioModeTabs({
  projectId,
  activeMode,
  unlocked,
  onNativeMode,
}: {
  projectId: string;
  activeMode: CanvasMode;
  unlocked: ReadonlySet<CanvasMode>;
  onNativeMode: (mode: NativeWebGLMode) => void;
}) {
  return (
    <nav
      data-testid="studio-mode-tabs"
      aria-label="Studio modes"
      style={{
        position: "absolute",
        top: 72,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: 2,
        padding: "3px 4px",
        borderRadius: "var(--gs-radius-pill)",
        background: "var(--gs-glass-veil)",
        backdropFilter: "blur(var(--gs-blur))",
        WebkitBackdropFilter: "blur(var(--gs-blur))",
        border: "1px solid color-mix(in srgb, var(--gs-line) 55%, transparent)",
        boxShadow: "var(--gs-shadow-1)",
        pointerEvents: "auto",
        zIndex: 5,
        maxWidth: "calc(100% - 120px)",
        overflowX: "auto",
        scrollbarWidth: "none",
      }}
    >
      {CANVAS_MODES.map(({ id, label }) => {
        const locked = !unlocked.has(id);
        const active = id === activeMode && !locked;

        const shared: React.CSSProperties = {
          fontFamily: "var(--font-ui)",
          fontSize: 11,
          letterSpacing: "0.04em",
          padding: "3px 9px",
          borderRadius: "var(--gs-radius-pill)",
          border: "1px solid transparent",
          whiteSpace: "nowrap",
          cursor: locked ? "not-allowed" : "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        };

        if (locked) {
          const reason = lockReasonForMode(id, unlocked);
          return (
            <span
              key={id}
              data-testid={`mode-tab-${id}`}
              aria-disabled="true"
              title={reason ?? "Locked"}
              style={{
                ...shared,
                color: "var(--gs-ink-secondary)",
                border: "1px solid var(--gs-line-soft)",
                cursor: "not-allowed",
              }}
            >
              {label}
            </span>
          );
        }

        if (isNativeWebGLMode(id)) {
          return (
            <button
              key={id}
              type="button"
              data-testid={`mode-tab-${id}`}
              aria-label={`Mode ${label}`}
              onClick={() => onNativeMode(id)}
              style={{
                ...shared,
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
                if (!active) e.currentTarget.style.color = "var(--gs-ink-secondary)";
              }}
            >
              {label}
            </button>
          );
        }

        return (
          <a
            key={id}
            data-testid={`mode-tab-${id}`}
            href={`/projects/${projectId}?svg=1&mode=${id}`}
            title={`${label} — opens the classic board in ${label} mode`}
            style={{
              ...shared,
              background: active ? "var(--gs-chip-active)" : "transparent",
              color: active
                ? "var(--gs-chip-active-ink)"
                : "var(--gs-ink-secondary)",
              textDecoration: "none",
            }}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.color = "var(--gs-ink)";
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.color = "var(--gs-ink-secondary)";
            }}
          >
            {label}
            <span aria-hidden style={{ fontSize: 9.5, opacity: 0.7 }}>
              ⤢
            </span>
          </a>
        );
      })}
    </nav>
  );
}
