"use client";

/**
 * Gold Standard 2026 — summonable shortcut list (?).
 *
 * Paper card over the drawing. Esc / ? / click-off dismisses. The rows
 * come from studioShortcuts.ts so the overlay cannot drift from the map.
 */

import { useEffect } from "react";
import { Button } from "./Button";
import { SHORTCUT_ROWS } from "./studioShortcuts";

export function StudioShortcutsHelp({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const groups = ["View", "Mode", "Tool", "Edit"] as const;

  return (
    <div
      data-testid="studio-shortcuts-help"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        pointerEvents: "auto",
        background: "color-mix(in srgb, var(--ws-canvas) 55%, transparent)",
        zIndex: "var(--cf-z-app)",
      }}
      onClick={onClose}
    >
      <div
        data-gs-glass-card
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(420px, 92vw)",
          maxHeight: "min(520px, calc(100dvh - 80px))",
          overflowY: "auto",
          padding: "14px 16px",
          borderRadius: "var(--ws-radius-3)",
          background: "var(--ws-panel)",
          border: "1px solid color-mix(in srgb, var(--ws-line) 55%, transparent)",
          boxShadow: "var(--ws-shadow-2)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 10,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-tech)",
              fontSize: "var(--ws-text-xs)",
              fontWeight: 600,
              letterSpacing: "0.06em",
              color: "var(--ws-ink)",
            }}
          >
            SHORTCUTS
          </span>
          <Button
            variant="text"
            aria-label="Close shortcuts"
            data-testid="studio-shortcuts-close"
            onClick={onClose}
            style={{ color: "var(--ws-ink-muted)", padding: "0 4px" }}
          >
            ×
          </Button>
        </div>
        {groups.map((group) => (
          <div key={group} style={{ marginBottom: 10 }}>
            <div
              style={{
                fontFamily: "var(--font-tech)",
                fontSize: "var(--ws-text-xs)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--ws-ink-secondary)",
                marginBottom: 4,
              }}
            >
              {group}
            </div>
            {SHORTCUT_ROWS.filter((r) => r.group === group).map((r) => (
              <div
                key={`${r.group}-${r.keys}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "var(--ws-space-4)",
                  padding: "3px 0",
                  fontFamily: "var(--font-ui)",
                  fontSize: "var(--ws-text-xs)",
                  color: "var(--ws-ink)",
                }}
              >
                <span>{r.action}</span>
                <kbd
                  style={{
                    fontFamily: "var(--font-tech)",
                    fontSize: "var(--ws-text-xs)",
                    letterSpacing: "0.04em",
                    color: "var(--ws-ink-secondary)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.keys}
                </kbd>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
