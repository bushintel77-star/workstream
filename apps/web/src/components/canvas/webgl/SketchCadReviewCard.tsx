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
import { Button } from "./Button";
import { GlassCard } from "./GlassCard";

const rowBase: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "var(--gs-space-4)",
  width: "100%",
  padding: "6px 8px",
  border: "1px solid transparent",
  borderRadius: "var(--gs-radius-chip)",
  background: "transparent",
  color: "var(--la-ink-secondary)",
  fontFamily: "var(--font-ui)",
  fontSize: "var(--gs-font-sm)",
  cursor: "pointer",
  textAlign: "left",
};

export function SketchCadReviewCard({ docked = false }: { docked?: boolean }) {
  const proposals = useStudioStore((s) => s.cadProposals);
  const open = useStudioStore((s) => s.cadReviewOpen);
  const activeId = useStudioStore((s) => s.cadActiveProposalId);
  const notice = useStudioStore((s) => s.sketchCadNotice);
  const setActive = useStudioStore((s) => s.setCadActiveProposal);
  const accept = useStudioStore((s) => s.acceptCadProposal);
  const reject = useStudioStore((s) => s.rejectCadProposal);
  const acceptAll = useStudioStore((s) => s.acceptAllCadProposals);
  const acceptConfident = useStudioStore((s) => s.acceptConfidentCadProposals);
  const rejectAll = useStudioStore((s) => s.rejectAllCadProposals);
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
    <div data-testid="cad-review">
    <GlassCard
      /* Docked — a flow child of the UnifiedPanel body (the floating
       * top-right card retired with the hidden right dock: it would sit
       * under the flush panel). Floating position stays available for any
       * future standalone mount. */
      position={docked ? undefined : "top-right"}
      style={docked ? { position: "relative", width: "100%" } : { width: 288 }}
      scrollBody={true}
      header={
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span
            style={{
              fontFamily: "var(--font-tech)",
              fontSize: "var(--gs-font-sm)",
              fontWeight: 600,
              letterSpacing: "0.06em",
              color: "var(--la-ink)",
            }}
          >
            SKETCH → CAD · {sorted.length}
          </span>
          <Button
            variant="text"
            data-testid="cad-review-close"
            aria-label="Close sketch CAD review"
            onClick={() => close(false)}
            style={{
              color: "var(--la-ink-muted)",
              fontSize: "var(--gs-font-sm)",
              padding: "2px 6px",
            }}
          >
            ✕
          </Button>
        </div>
      }
      footer={
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--gs-space-3)" }}>
          <div
            style={{
              display: "flex",
              gap: "var(--gs-space-3)",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <Button
              variant="cta"
              data-testid="cad-accept"
              onClick={() => accept(active.id)}
              style={{ flex: 1 }}
            >
              Accept
            </Button>
            <Button
              variant="ghost-line"
              data-testid="cad-reject"
              onClick={() => reject(active.id)}
            >
              Reject
            </Button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--gs-space-2)" }}>
            <Button
              variant="text"
              data-testid="cad-accept-all"
              onClick={acceptAll}
              style={{
                color: "var(--la-accent)",
                fontSize: "var(--gs-font-sm)",
                padding: "4px 8px",
              }}
            >
              Accept all {sorted.length}
            </Button>
            {sorted.some((p) => p.confidence >= 0.7) ? (
              <Button
                variant="text"
                data-testid="cad-accept-confident"
                onClick={() => acceptConfident(0.7)}
                style={{
                  color: "var(--la-ink)",
                  fontSize: "var(--gs-font-sm)",
                  padding: "4px 8px",
                }}
              >
                Accept ≥70%
              </Button>
            ) : null}
            <Button
              variant="text"
              data-testid="cad-reject-all"
              onClick={rejectAll}
              style={{
                color: "var(--la-ink-secondary)",
                fontSize: "var(--gs-font-sm)",
                padding: "4px 8px",
              }}
            >
              Reject all
            </Button>
          </div>
        </div>
      }
    >
      {photoScoped && (
        <p
          role="status"
          data-testid="cad-review-notice"
          style={{
            margin: 0,
            fontSize: "var(--gs-font-xs)",
            lineHeight: 1.4,
            color: "var(--la-error)",
            border: "1px solid color-mix(in srgb, var(--la-error) 40%, transparent)",
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
        style={{ display: "flex", flexDirection: "column", gap: "var(--gs-space-1)" }}
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
                  : "var(--la-ink-secondary)",
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
          gap: "var(--gs-space-3)",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "var(--gs-font-xs)",
            lineHeight: 1.4,
            color: "var(--la-ink-secondary)",
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
              background: "var(--la-ink)",
            }}
          />
        </div>
      </div>
    </GlassCard>
    </div>
  );
}
