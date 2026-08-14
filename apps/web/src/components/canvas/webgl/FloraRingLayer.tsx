"use client";

/**
 * Gold Standard 2026 — Flora Ring Layer (ranked suggestions at a click).
 *
 * The AI intelligence layer of the Asset Fan-Out: when a flora-form symbol
 * is armed and the operator clicks the lot, AssetPlaceLayer opens a flora
 * session at that point; this layer renders the ring —
 *
 *   - A ghost canopy disc sized by the active candidate's mature spread,
 *     conflict-tinted by the domain planting guard (TPZ / canopy overlap).
 *   - THE RING CARD — the studio's first CLICKABLE drei <Html>: candidate
 *     chips (real catalog botany + `why` microcopy), the sun/exposure chip
 *     (the Solar Impact delta, live-linked to the sun scrubber), the
 *     guard-aware Place button, and "Not now".
 *
 * Candidates are DERIVED here in useMemo (session point × placements ×
 * sunMin × address) — nothing is stored but {x, y, form, activeIdx}, so
 * scrubbing the sun re-ranks the ring in place. Accept mints the placement
 * (scale from the candidate's spread, SVG acceptFlora parity) and disarms;
 * dismiss keeps the tool armed (SVG semantics).
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 (flora intelligence layer)
 */

import { useMemo } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import {
  assessPlantingPlacement,
  plantingConflictSummary,
} from "@workstream/domain";
import { PALETTE } from "../../../styles/colorTokens";
import { useStudioStore } from "./studioStore";
import { pctToWorld } from "./coordTransform";
import { BY_TYPE } from "../handoff/studioCatalog";
import { mapSymbolToStudioType } from "../handoff/state/studioAiEngine";
import {
  rankAtPoint,
  exposureLabel,
  placementScaleFor,
} from "./floraWorld";

const GOLD = "var(--gs-primary)";

const cardStyle: React.CSSProperties = {
  width: 268,
  padding: "12px 14px",
  borderRadius: 14,
  border: `1px solid color-mix(in srgb, ${GOLD} 40%, transparent)`,
  background: "color-mix(in srgb, var(--gs-glass) 88%, transparent)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  fontFamily: "var(--font-ui)",
  color: "var(--gs-ink)",
  pointerEvents: "auto",
  cursor: "default",
  userSelect: "none",
};

const chipBase: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "6px 8px",
  borderRadius: 8,
  border: "1px solid var(--gs-line)",
  background: "transparent",
  cursor: "pointer",
  marginBottom: 4,
};

export interface FloraRingLayerProps {
  scaleM: number;
  boardAspect: number;
  lat: number;
  lng: number;
}

export function FloraRingLayer({
  scaleM,
  boardAspect,
  lat,
  lng,
}: FloraRingLayerProps) {
  const session = useStudioStore((s) => s.floraSession);
  const setFloraSession = useStudioStore((s) => s.setFloraSession);
  const setFloraActiveIdx = useStudioStore((s) => s.setFloraActiveIdx);
  const placements = useStudioStore((s) => s.placements);
  const sunMin = useStudioStore((s) => s.sunMin);
  const address = useStudioStore((s) => s.projectAddress);
  const addPlacement = useStudioStore((s) => s.addPlacement);
  const setArmedSymbolId = useStudioStore((s) => s.setArmedSymbolId);

  // Guard items: placements + the BY_TYPE canopy radii (the SVG recipe).
  const guardItems = useMemo(
    () =>
      placements.map((p) => {
        const t = mapSymbolToStudioType(p.symbol_id);
        return {
          id: p.id,
          t,
          x: p.x_pct,
          y: p.y_pct,
          scale: p.scale,
          canopyM: BY_TYPE[t]?.canopyM,
        };
      }),
    [placements],
  );

  // Ranked candidates — re-derive when the point, canopy, sun, or address move.
  const ranked = useMemo(() => {
    if (!session) return null;
    return rankAtPoint({
      form: session.form,
      xPct: session.x,
      yPct: session.y,
      items: guardItems,
      lat,
      lng,
      sunMin,
      address,
    });
  }, [session, guardItems, lat, lng, sunMin, address]);

  if (!session || !ranked || ranked.candidates.length === 0) return null;

  const active =
    ranked.candidates[
      Math.min(session.activeIdx, ranked.candidates.length - 1)
    ]!;

  // Guard: is the ACTIVE candidate placeable at the session point?
  const conflicts = assessPlantingPlacement({
    xPct: session.x,
    yPct: session.y,
    canopySpreadM: active.canopySpreadM,
    items: guardItems,
    scaleM,
  });
  const summary = plantingConflictSummary(conflicts);

  const [wx, wz] = pctToWorld({ x: session.x, y: session.y }, scaleM, boardAspect);
  // World units are metres — the ghost radius is half the mature spread.
  const ghostRadiusM = Math.max(0.6, active.canopySpreadM / 2);

  const accept = () => {
    if (summary.blocked) return;
    addPlacement({
      id: crypto.randomUUID(),
      symbol_id: active.symbolId,
      x_pct: session.x,
      y_pct: session.y,
      rotation_deg: 0,
      scale: placementScaleFor(active),
    });
    setFloraSession(null);
    setArmedSymbolId(null);
  };

  return (
    <group>
      {/* Ghost canopy disc at the click point — conflict-tinted preview */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[wx, 0.05, wz]}>
        <ringGeometry args={[ghostRadiusM - 0.15, ghostRadiusM, 32]} />
        <meshBasicMaterial
          color={summary.blocked ? PALETTE.gsConflict : PALETTE.gsPrimary}
          transparent
          opacity={0.85}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[wx, 0.045, wz]}>
        <circleGeometry args={[ghostRadiusM, 32]} />
        <meshBasicMaterial
          color={summary.blocked ? PALETTE.gsConflict : PALETTE.gsPrimary}
          transparent
          opacity={0.1}
          depthWrite={false}
        />
      </mesh>

      {/* The ring card — first clickable drei <Html> in the studio */}
      <Html position={[wx, 0.1, wz]} center zIndexRange={[30, 20]}>
        <div data-testid="flora-ring" style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontSize: 10,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--gs-ink-secondary)",
              }}
            >
              Flora · indicative
            </span>
            <span
              data-testid="flora-sun-chip"
              style={{
                fontFamily: "var(--font-tech)",
                fontSize: 10,
                color: "var(--gs-truth)",
                border: "1px solid color-mix(in srgb, var(--gs-truth) 35%, transparent)",
                borderRadius: 999,
                padding: "1px 7px",
              }}
            >
              {ranked.sunHours.toFixed(1)} h · {exposureLabel(ranked.sunHours)}
            </span>
          </div>

          {ranked.candidates.map((c, i) => {
            const isActive = i === Math.min(session.activeIdx, ranked.candidates.length - 1);
            return (
              <button
                key={c.symbolId}
                data-testid={`flora-chip-${c.symbolId}`}
                onClick={() => setFloraActiveIdx(i)}
                style={{
                  ...chipBase,
                  borderColor: isActive
                    ? `color-mix(in srgb, ${GOLD} 45%, transparent)`
                    : "var(--gs-line)",
                  background: isActive
                    ? `color-mix(in srgb, ${GOLD} 8%, transparent)`
                    : "transparent",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{c.label}</span>
                  {c.plantWindow === "spring_hold" && (
                    <span
                      style={{
                        fontSize: 9,
                        fontFamily: "var(--font-tech)",
                        color: "var(--gs-primary)",
                      }}
                    >
                      Spring hold
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-tech)",
                    fontSize: 10,
                    color: "var(--gs-ink-secondary)",
                    marginTop: 2,
                  }}
                >
                  <em>{c.botanicalName}</em> · {c.matureHeightM.toFixed(1)} m ·{" "}
                  {c.sun}
                </div>
                <div style={{ fontSize: 10, color: "var(--gs-ink-secondary)", marginTop: 2 }}>
                  {c.why}
                </div>
              </button>
            );
          })}

          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button
              data-testid="flora-accept"
              onClick={accept}
              disabled={summary.blocked}
              style={{
                flex: 1,
                padding: "6px 10px",
                borderRadius: 999,
                border: `1px solid color-mix(in srgb, ${GOLD} 50%, transparent)`,
                background: summary.blocked
                  ? "transparent"
                  : `color-mix(in srgb, ${GOLD} 20%, transparent)`,
                color: summary.blocked ? "var(--gs-conflict)" : "var(--gs-primary)",
                fontFamily: "var(--font-ui)",
                fontSize: 11,
                fontWeight: 600,
                cursor: summary.blocked ? "not-allowed" : "pointer",
              }}
            >
              {summary.blocked ? "Blocked — shift clear" : `Place ${active.label}`}
            </button>
            <button
              data-testid="flora-dismiss"
              onClick={() => setFloraSession(null)}
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid var(--gs-line)",
                background: "transparent",
                color: "var(--gs-ink-secondary)",
                fontFamily: "var(--font-ui)",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              Not now
            </button>
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 9,
              color: "var(--gs-ink-secondary)",
            }}
          >
            Indicative suitability — confirm on site / soil / nursery lead time
          </div>
        </div>
      </Html>
    </group>
  );
}
