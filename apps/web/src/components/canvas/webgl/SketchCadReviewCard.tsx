"use client";

/**
 * Gold Standard 2026 — Sketch → CAD ghost review card.
 *
 * The WebGL-native review surface for tidy-stroke proposals. Interaction
 * contract matches the SVG studio's proven `AiGhostReview` pattern — a
 * confidence-scored row list, selected-row detail with the classifier
 * reason, a confidence track, and Accept / Reject per proposal — not a new
 * pattern invented from scratch. Ghosts never persist: accept mints a live
 * placement (with a mirrored polygon feature when the proposal carried a
 * drawn outline); reject drops the proposal. Source ink is always kept.
 *
 * Photo-trace strokes are stamped here as scoped out (elevation-space) —
 * a visible gap, never a silent exclusion.
 */

import { useMemo } from "react";
import { useStudioStore } from "./studioStore";
import { proposalLabel } from "./sketchCad";

const panel: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  width: 288,
  maxHeight: "calc(100dvh - 220px)",
  overflowY: "auto",
  pointerEvents: "auto",
};

const rowBase: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  width: "100%",
  padding: "6px 8px",
  border: "1px solid transparent",
  borderRadius: "var(--gs-radius-chip)",
  background: "transparent",
  color: "var(--gs-ink-secondary)",
  fontFamily: "var(--font-ui)",
  fontSize: 11,
  cursor: "pointer",
  textAlign: "left",
};

export function SketchCadReviewCard() {
  const proposals = useStudioStore((s) => s.cadProposals);
  const open = useStudioStore((s) => s.cadReviewOpen);
  const activeId = useStudioStore((s) => s.cadActiveProposalId);
  const notice = useStudioStore((s) => s.sketchCadNotice);
  const setActive = useStudioStore((s) => s.setCadActiveProposal);
  const accept = useStudioStore((s) => s.acceptCadProposal);
  const reject = useStudioStore((s) => s.rejectCadProposal);
  const acceptAll = useStudioStore((s) => s.acceptAllCadProposals);
  const close = useStudioStore((s) => s.setCadReviewOpen);

  const sorted = useMemo(
    () => [...proposals].sort((a, b) => b.confidence - a.confidence),
    [proposals],
  );

  if (!open || sorted.length === 0) return null;

  const active = sorted.find((p) => p.id === activeId) ?? sorted[0]!;
  const pct = Math.round(active.confidence * 100);
  const photoScoped = notice != null && /photo-traced/.test(notice);

  return (
    <div style={panel} data-testid="cad-review">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-tech)",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.06em",
            color: "var(--gs-ink)",
          }}
        >
          SKETCH → CAD · {sorted.length}
        </span>
        <button
          type="button"
          data-testid="cad-review-close"
          aria-label="Close sketch CAD review"
          onClick={() => close(false)}
          style={{
            border: "none",
            background: "transparent",
            color: "var(--gs-ink-muted)",
            fontFamily: "var(--font-ui)",
            fontSize: 11,
            cursor: "pointer",
            padding: "2px 6px",
          }}
        >
          ✕
        </button>
      </div>

      {photoScoped && (
        <p
          role="status"
          data-testid="cad-review-notice"
          style={{
            margin: 0,
            fontSize: 10.5,
            lineHeight: 1.4,
            color: "var(--gs-ink-conflict)",
            border: "1px solid color-mix(in srgb, var(--gs-ink-conflict) 40%, transparent)",
            borderRadius: "var(--gs-radius-chip)",
            padding: "6px 8px",
          }}
        >
          {notice}
        </p>
      )}

      <div
        role="group"
        aria-label="Sketch to CAD proposals"
        style={{ display: "flex", flexDirection: "column", gap: 2 }}
      >
        {sorted.map((p) => {
          const isActive = p.id === active.id;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={isActive}
              data-testid="cad-proposal-row"
              data-conf={Math.round(p.confidence * 100)}
              onClick={() => setActive(p.id)}
              style={{
                ...rowBase,
                background: isActive
                  ? "var(--gs-chip-active)"
                  : "transparent",
                color: isActive
                  ? "var(--gs-chip-active-ink)"
                  : "var(--gs-ink-secondary)",
                borderColor: isActive
                  ? "transparent"
                  : "color-mix(in srgb, var(--gs-line) 55%, transparent)",
              }}
            >
              <span>{proposalLabel(p.symbol_id)}</span>
              <span
                style={{
                  fontFamily: "var(--font-tech)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {Math.round(p.confidence * 100)}%
              </span>
            </button>
          );
        })}
      </div>

      <div
        style={{
          borderTop: "1px solid color-mix(in srgb, var(--gs-line) 55%, transparent)",
          paddingTop: 8,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 10.5,
            lineHeight: 1.4,
            color: "var(--gs-ink-secondary)",
          }}
        >
          {active.reason}
        </p>
        <div
          role="meter"
          aria-label="Proposal confidence"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{
            height: 4,
            borderRadius: "var(--gs-radius-pill)",
            background: "color-mix(in srgb, var(--gs-line) 55%, transparent)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: "var(--gs-ink)",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            data-testid="cad-accept"
            onClick={() => accept(active.id)}
            style={{
              flex: 1,
              padding: "5px 8px",
              border: "1px solid var(--gs-primary)",
              borderRadius: "var(--gs-radius-chip)",
              background: "var(--gs-primary)",
              color: "var(--gs-panel)",
              fontFamily: "var(--font-ui)",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Accept
          </button>
          <button
            type="button"
            data-testid="cad-reject"
            onClick={() => reject(active.id)}
            style={{
              padding: "5px 8px",
              border: "1px solid color-mix(in srgb, var(--gs-line-strong) 60%, transparent)",
              borderRadius: "var(--gs-radius-chip)",
              background: "transparent",
              color: "var(--gs-ink-secondary)",
              fontFamily: "var(--font-ui)",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            Reject
          </button>
        </div>
        <button
          type="button"
          data-testid="cad-accept-all"
          onClick={acceptAll}
          style={{
            padding: "4px 8px",
            border: "none",
            borderRadius: "var(--gs-radius-chip)",
            background: "transparent",
            color: "var(--gs-primary)",
            fontFamily: "var(--font-ui)",
            fontSize: 11,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          Accept all {sorted.length}
        </button>
      </div>
    </div>
  );
}
