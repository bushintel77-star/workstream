"use client";

/**
 * Gold Standard 2026 — Instrument Card (collapsible meta chip).
 *
 * Right-column instruments (fit-sheet, section, flow, earthworks) render as
 * one-line meta chips — the same idiom as the Season/Leaf/Sun chip row —
 * and expand on click. Fixes the zoomed-out board being crowded by card
 * bodies: metadata at the border, detail on demand.
 */

import { useState, type ReactNode } from "react";
import { GlassCard } from "./GlassCard";

export function InstrumentCard({
  label,
  value,
  accent = false,
  testId,
  children,
}: {
  label: string;
  /** The one figure worth showing while collapsed (e.g. "$705" / "12.4 L/s"). */
  value: string;
  accent?: boolean;
  testId?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const colour = accent ? "var(--gs-primary)" : "var(--gs-ink-truth)";

  return open ? (
    <GlassCard position={{ position: "relative" }} style={{ padding: "8px 10px" }}>
      <div
        data-testid={testId}
        style={{ display: "flex", flexDirection: "column", gap: 6 }}
      >
        <button
          type="button"
          aria-label={`Collapse ${label}`}
          onClick={() => setOpen(false)}
          style={{
            all: "unset",
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            fontFamily: "var(--font-ui)",
            fontSize: 10.5,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--gs-ink-secondary)",
          }}
        >
          <span>{label}</span>
          <span style={{ fontFamily: "var(--font-tech)", color: "var(--gs-ink-muted)" }}>
            collapse ▴
          </span>
        </button>
        {children}
      </div>
    </GlassCard>
  ) : (
    <button
      type="button"
      data-testid={testId ? testId + "-chip" : undefined}
      aria-label={`Expand ${label}`}
      onClick={() => setOpen(true)}
      style={{
        all: "unset",
        boxSizing: "border-box",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "baseline",
        gap: 8,
        padding: "4px 9px",
        borderRadius: "var(--gs-radius-pill)",
        background: "color-mix(in srgb, var(--gs-glass) 38%, transparent)",
        backdropFilter: "blur(var(--gs-blur))",
        WebkitBackdropFilter: "blur(var(--gs-blur))",
        border: "1px solid color-mix(in srgb, var(--gs-line) 35%, transparent)",
        fontFamily: "var(--font-ui)",
        fontSize: 10.5,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--gs-ink-secondary)",
        whiteSpace: "nowrap",
      }}
    >
      <span>{label}</span>
      <span
        style={{
          fontFamily: "var(--font-tech)",
          fontSize: 11.5,
          fontWeight: 600,
          textTransform: "none",
          letterSpacing: 0,
          color: colour,
        }}
      >
        {value}
      </span>
    </button>
  );
}
