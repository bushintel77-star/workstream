"use client";

/**
 * Gold Standard 2026 — Sketch → CAD ghost proposal markers.
 *
 * In-canvas visuals for the pending tidy proposals: a Signal Blue ring at
 * each proposed centre, the drawn outline loop for closed masses (dashed),
 * and a constant-px confidence chip on the proposal the review card is
 * emphasising. Ghosts are ephemeral until accept — they never persist.
 */

import { Html, Line } from "@react-three/drei";
import type { SketchCadProposal } from "./sketchCad";
import { useStudioStore } from "./studioStore";
import { pctToWorld } from "./coordTransform";
import { PALETTE } from "../../../styles/colorTokens";
import { cfZPair } from "../cfz";

const GHOST_Y = 0.06;

export interface CadProposalLayerProps {
  scaleM: number;
  boardAspect: number;
}

export function CadProposalLayer({ scaleM, boardAspect }: CadProposalLayerProps) {
  const proposals = useStudioStore((s) => s.cadProposals);
  const activeId = useStudioStore((s) => s.cadActiveProposalId);

  if (proposals.length === 0) return null;

  return (
    <group>
      {proposals.map((p) => (
        <ProposalMarker
          key={p.id}
          proposal={p}
          active={p.id === activeId}
          scaleM={scaleM}
          boardAspect={boardAspect}
        />
      ))}
    </group>
  );
}

function ProposalMarker({
  proposal,
  active,
  scaleM,
  boardAspect,
}: {
  proposal: SketchCadProposal;
  active: boolean;
  scaleM: number;
  boardAspect: number;
}) {
  const [wx, wz] = pctToWorld(
    { x: proposal.x_pct, y: proposal.y_pct },
    scaleM,
    boardAspect,
  );
  const outline =
    proposal.outlinePct && proposal.outlinePct.length >= 3
      ? proposal.outlinePct.map((p) => {
          const [x, z] = pctToWorld(p, scaleM, boardAspect);
          return [x, GHOST_Y, z] as [number, number, number];
        })
      : null;

  return (
    <group>
      <mesh position={[wx, GHOST_Y, wz]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.7, 0.85, 24]} />
        <meshBasicMaterial
          color={PALETTE.gsPrimary}
          transparent
          opacity={active ? 0.95 : 0.6}
          depthWrite={false}
        />
      </mesh>
      {outline && (
        <Line
          points={outline}
          color={PALETTE.gsPrimary}
          lineWidth={1.5}
          dashed
          dashSize={0.5}
          gapSize={0.3}
          transparent
          opacity={active ? 0.85 : 0.45}
        />
      )}
      {active && (
        <Html
          position={[wx, GHOST_Y + 0.8, wz]}
          center
          zIndexRange={cfZPair("spatialAnnotation")}
          style={{ pointerEvents: "none" }}
        >
          <span
            data-testid="cad-proposal-chip"
            style={{
              fontFamily: "var(--font-tech)",
              fontSize: "var(--gs-font-sm)",
              fontWeight: 600,
              color: "var(--gs-panel)",
              background: "var(--gs-primary)",
              borderRadius: "var(--gs-radius-pill)",
              padding: "1px 8px",
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            {Math.round(proposal.confidence * 100)}%
          </span>
        </Html>
      )}
    </group>
  );
}
