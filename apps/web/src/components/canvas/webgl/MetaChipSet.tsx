"use client";

/**
 * Gold Standard 2026 — Vicmap Meta Chip-Set (ambient spatial telemetry).
 *
 * Satellite tags for the title boundary: each chip anchors to a boundary
 * node (B1…Bn) and is parked outside the parcel by the shared perimeter
 * annotation solver (`annotationLayout.ts`), which picks the viewport edge
 * that avoids earlier labels and crossing leaders. A dashed leader ties
 * every label back to the node it describes.
 *
 * Projection and placement run in `useFrame` and write straight to DOM refs
 * — the SubsurfaceStudio / GrowthStudio label convention. The camera matrix
 * mutates without notifying React, so a memo keyed on a quantised zoom
 * would strand the chips on pan and orbit.
 *
 * - Ambient resting state: 40% opacity capsules, muted ink.
 * - Phase-aware illumination: the active canvas mode lights its group to
 *   full strength and dims the rest.
 * - In-place expansion: hover/click unfolds a micro-tooltip.
 *
 * Data is derived, never invented — an absent record renders no chip
 * (zero-mock law). Chips are hidden in present/share (the lens strips
 * technical truth by design).
 */

import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { pctToWorld, type PctPoint } from "./coordTransform";
import type { MetaChip } from "./metaChips";
import { cfZPair } from "../cfz";
import { Button } from "./Button";
import {
  layoutPerimeterAnnotations,
  type AnnotationAnchor,
} from "./annotationLayout";

/** Chip anchor height above the ground (above dims, below slice). */
const CHIP_Y = 0.09;
/** Label box the solver reserves per chip, in screen pixels. */
const LABEL_WIDTH = 170;
const LABEL_HEIGHT = 30;
/** Keep the ring legible — the highest-priority records win the frame. */
const MAX_VISIBLE = 8;
/** Viewport inset the solver parks labels within. */
const EDGE_PADDING = 24;

const detailStyle: React.CSSProperties = {
  position: "absolute",
  bottom: "calc(100% + 6px)",
  left: "50%",
  transform: "translateX(-50%)",
  width: 220,
  padding: "8px 10px",
  /* Paper glass detail card, not dark glass (design-spec §5 / debt D8) —
   * dark chrome is reserved for the presentation lens. */
  background: "var(--gs-glass-veil)",
  backdropFilter: "blur(var(--gs-blur))",
  WebkitBackdropFilter: "blur(var(--gs-blur))",
  border: "1px solid color-mix(in srgb, var(--gs-line) 55%, transparent)",
  borderRadius: "var(--gs-radius-panel)",
  boxShadow: "var(--gs-shadow-3)",
  color: "var(--gs-ink)",
  fontFamily: "var(--font-ui)",
  fontSize: "var(--gs-font-sm)",
  lineHeight: 1.45,
  pointerEvents: "auto",
};

const leaderLayerStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  overflow: "visible",
  pointerEvents: "none",
};

export interface MetaChipSetProps {
  boundaryPct: PctPoint[];
  scaleM: number;
  boardAspect: number;
  mode: string;
  chips: MetaChip[];
}

function groupPriority(chip: MetaChip): number {
  if (chip.id === "spi" || chip.id === "easement" || chip.id === "heritage" || chip.id === "flood") return 100;
  if (chip.group === "cadastral") return 80;
  if (chip.group === "planning") return 70;
  return 40;
}

export function MetaChipSet({ boundaryPct, scaleM, boardAspect, mode, chips }: MetaChipSetProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const labelRefs = useRef(new Map<string, HTMLDivElement | null>());
  const leaderRefs = useRef(new Map<string, SVGPolylineElement | null>());
  const scratch = useRef(new THREE.Vector3());

  const nodes = useMemo(() => {
    if (boundaryPct.length < 3) return [];
    return boundaryPct.map((p) => pctToWorld(p, scaleM, boardAspect));
  }, [boundaryPct, scaleM, boardAspect]);

  const visibleChips = useMemo(
    () =>
      [...chips]
        .sort((a, b) => groupPriority(b) - groupPriority(a) || a.id.localeCompare(b.id))
        .slice(0, MAX_VISIBLE),
    [chips],
  );

  const hidden = mode === "present" || mode === "share";

  useFrame(({ camera, size }) => {
    if (hidden || nodes.length === 0 || visibleChips.length === 0) return;
    const anchors: AnnotationAnchor[] = visibleChips.map((chip, index) => {
      const node = nodes[index % nodes.length]!;
      const ndc = scratch.current.set(node[0], CHIP_Y, node[1]).project(camera);
      return {
        id: chip.id,
        x: ((ndc.x + 1) * size.width) / 2,
        y: ((1 - ndc.y) * size.height) / 2,
        priority: groupPriority(chip),
      };
    });
    const placements = layoutPerimeterAnnotations(anchors, {
      width: size.width,
      height: size.height,
      labelWidth: LABEL_WIDTH,
      labelHeight: LABEL_HEIGHT,
      padding: EDGE_PADDING,
      maxVisible: MAX_VISIBLE,
    });
    for (const placement of placements) {
      const label = labelRefs.current.get(placement.id);
      if (label) {
        label.style.transform = `translate3d(${Math.round(placement.label.x)}px, ${Math.round(placement.label.y)}px, 0)`;
      }
      const leader = leaderRefs.current.get(placement.id);
      if (leader) {
        leader.setAttribute(
          "points",
          placement.leader.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" "),
        );
      }
    }
  });

  if (hidden || chips.length === 0 || nodes.length === 0) return null;

  return (
    <Html fullscreen zIndexRange={cfZPair("chromeChip")} style={{ pointerEvents: "none" }}>
      <svg aria-hidden style={leaderLayerStyle}>
        {visibleChips.map((chip) => (
          <polyline
            key={chip.id}
            ref={(el) => {
              leaderRefs.current.set(chip.id, el);
            }}
            fill="none"
            stroke="var(--gs-line-strong)"
            strokeWidth={1}
            strokeDasharray="4 3"
            opacity={0.7}
          />
        ))}
      </svg>
      {visibleChips.map((chip) => {
        const bright = chip.brightModes.includes(mode);
        const expanded = expandedId === chip.id;
        return (
          <div
            key={chip.id}
            ref={(el) => {
              labelRefs.current.set(chip.id, el);
            }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: LABEL_WIDTH,
              height: LABEL_HEIGHT,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "auto",
              willChange: "transform",
            }}
            onPointerEnter={() => setExpandedId(chip.id)}
            onPointerLeave={() => setExpandedId(null)}
          >
            {expanded ? (
              <span style={detailStyle} data-testid={`meta-chip-${chip.id}-detail`}>
                {chip.detail}
              </span>
            ) : null}
            <Button
              variant="capsule"
              data-testid={`meta-chip-${chip.id}`}
              aria-label={`${chip.value}: ${chip.label}. ${chip.detail}`}
              onClick={() => setExpandedId(expanded ? null : chip.id)}
              style={{
                fontFamily: "var(--font-hand), 'Architects Daughter', cursive",
                opacity: bright ? 1 : expanded ? 0.95 : 0.4,
                color: bright ? "var(--gs-primary-ink)" : "var(--gs-ink-muted)",
                boxShadow: expanded ? "var(--gs-shadow-2)" : "var(--gs-shadow-1)",
              }}
            >
              <span style={{ fontWeight: 600 }}>{chip.label}</span>
              <span style={{ opacity: 0.75 }}>{chip.value}</span>
            </Button>
          </div>
        );
      })}
    </Html>
  );
}
