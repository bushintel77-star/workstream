"use client";

/**
 * Gold Standard 2026 — Vicmap Meta Chip-Set (ambient spatial telemetry).
 *
 * Satellite tags orbiting the title boundary: each chip anchors to a
 * boundary node (B1…Bn) at a fixed screen-pixel offset OUTSIDE the parcel
 * edge it describes, rather than parking in a screen corner or an inspector.
 *
 * - Ambient resting state: 40% opacity frost capsules, muted ink.
 * - Phase-aware illumination: the active canvas mode lights its group to
 *   full strength (survey/cad → cadastral + planning; elevation/garden →
 *   terrain) and dims the rest.
 * - In-place expansion: hover/click unfolds a micro-tooltip at the chip's
 *   origin; it dissolves when the cursor leaves.
 *
 * Data is derived, never invented — an absent record renders no chip
 * (zero-mock law). Chips are hidden in present/share (the lens strips
 * technical truth by design).
 */

import { useMemo, useState } from "react";
import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { pctToWorld, type PctPoint } from "./coordTransform";
import { useStudioStore } from "./studioStore";
import type { MetaChip } from "./metaChips";
import { cfZPair } from "../cfz";
import { Button } from "./Button";

/** Screen-pixel offset of the capsule outside the boundary node. */
const OFFSET_PX = 24;
/** Chip hover height above the ground (above dims, below slice). */
const CHIP_Y = 0.09;

const detailStyle: React.CSSProperties = {
  position: "absolute",
  bottom: "calc(100% + 6px)",
  left: "50%",
  transform: "translateX(-50%)",
  width: 220,
  padding: "8px 10px",
  background: "var(--gs-panel-grad)",
  border: "1px solid var(--line-hairline, color-mix(in srgb, var(--gs-line) 55%, transparent))",
  borderRadius: "var(--gs-radius-panel)",
  boxShadow: "var(--gs-shadow-3)",
  color: "var(--gs-ink-secondary)",
  fontFamily: "var(--font-ui)",
  fontSize: "var(--gs-font-sm)",
  fontWeight: 400,
  lineHeight: 1.45,
  pointerEvents: "auto",
};

export interface MetaChipSetProps {
  boundaryPct: PctPoint[];
  scaleM: number;
  boardAspect: number;
  mode: string;
  chips: MetaChip[];
}

export function MetaChipSet({
  boundaryPct,
  scaleM,
  boardAspect,
  mode,
  chips,
}: MetaChipSetProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Quantised zoom — same one-write-per-step pattern as DimensionLayer.
  const zoom = useStudioStore((s) => Math.round(s.liveRig.zoom * 2) / 2);
  const widthPx = useThree((s) => s.size.width);

  // Anchor chips to boundary nodes, cycling when chips outnumber nodes.
  const anchors = useMemo(() => {
    const world: Array<{ node: [number, number]; dir: [number, number] }> = [];
    let cx = 0;
    let cy = 0;
    const pts = boundaryPct.map((p) => {
      const [x, z] = pctToWorld(p, scaleM, boardAspect);
      cx += x;
      cy += z;
      return [x, z] as [number, number];
    });
    cx /= pts.length;
    cy /= pts.length;
    for (const [x, z] of pts) {
      const dx = x - cx;
      const dz = z - cy;
      const len = Math.hypot(dx, dz) || 1;
      world.push({ node: [x, z], dir: [dx / len, dz / len] });
    }
    return world;
  }, [boundaryPct, scaleM, boardAspect]);

  if (mode === "present" || mode === "share") return null;
  if (chips.length === 0 || boundaryPct.length < 3) return null;

  // 24 px screen offset → world metres at the current zoom.
  const pxPerMetre = Math.max((zoom * widthPx) / scaleM, 0.0001);
  const offsetM = OFFSET_PX / pxPerMetre;

  return (
    <group>
      {chips.map((chip, i) => {
        const anchor = anchors[i % anchors.length]!;
        const pos: [number, number, number] = [
          anchor.node[0] + anchor.dir[0] * offsetM,
          CHIP_Y,
          anchor.node[1] + anchor.dir[1] * offsetM,
        ];
        const bright = chip.brightModes.includes(mode);
        const expanded = expandedId === chip.id;
        return (
          <Html
            key={chip.id}
            position={pos}
            center
            zIndexRange={cfZPair("chromeChip")}
            style={{ pointerEvents: "auto" }}
          >
            <span
              style={{ position: "relative", display: "inline-block" }}
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
                  opacity: bright ? 1 : expanded ? 0.95 : 0.4,
                  color: bright ? "var(--gs-primary-ink)" : "var(--gs-ink-muted)",
                  transform: expanded ? "translateY(-1px)" : undefined,
                  boxShadow: expanded ? "var(--gs-shadow-2)" : "var(--gs-shadow-1)",
                }}
              >
                <span style={{ fontWeight: 600 }}>{chip.label}</span>
                <span style={{ opacity: 0.75 }}>{chip.value}</span>
              </Button>
            </span>
          </Html>
        );
      })}
    </group>
  );
}
