"use client";

import {
  pathCentrelineToSvg,
  pathCorridorRingPct,
  pathFilletCues,
  pathRingToSvg,
} from "@workstream/domain";
import type { PathCorridor } from "../../studioCatalog";
import css from "./pathCorridors.module.css";

type Props = {
  corridors: PathCorridor[];
  scaleM: number;
  /** Live draft centreline while tool=path. */
  draftPts?: Array<{ x: number; y: number }> | null;
  draftWidthM?: number;
  draftEdge?: string;
  draftFilletM?: number;
};

/** Residential path corridors — width buffer + edge hatch + fillet cues. */
export function PathCorridorsLayer({
  corridors,
  scaleM,
  draftPts,
  draftWidthM = 1.2,
  draftEdge = "sawn",
  draftFilletM = 0,
}: Props) {
  return (
    <div className={css.layer} data-testid="path-corridors-layer" aria-hidden>
      <svg className={css.svg} viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <pattern
            id="edge-soldier"
            width="2.4"
            height="2.4"
            patternUnits="userSpaceOnUse"
          >
            <path d="M0 0V2.4" stroke="rgba(70,78,88,0.55)" strokeWidth="0.35" />
          </pattern>
          <pattern
            id="edge-spalled"
            width="3"
            height="3"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="0.6" cy="0.8" r="0.35" fill="rgba(70,78,88,0.35)" />
            <circle cx="2.1" cy="1.9" r="0.45" fill="rgba(70,78,88,0.28)" />
          </pattern>
        </defs>
        {corridors.map((c) => {
          const ring = pathCorridorRingPct(c.points, c.pathWidthM, scaleM);
          const d = pathRingToSvg(ring);
          const cl = pathCentrelineToSvg(c.points);
          const cues = pathFilletCues(c.points, c.pathFilletM, scaleM);
          if (!d) return null;
          return (
            <g
              key={c.id}
              data-testid="path-corridor"
              data-edge={c.edgeType}
              data-material={c.material}
            >
              <path
                d={d}
                className={css.fill}
                data-material={c.material}
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={d}
                className={css.edge}
                data-edge={c.edgeType}
                fill={
                  c.edgeType === "soldier"
                    ? "url(#edge-soldier)"
                    : c.edgeType === "spalled"
                      ? "url(#edge-spalled)"
                      : "none"
                }
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={cl}
                className={css.centre}
                vectorEffect="non-scaling-stroke"
              />
              {cues.map((cue, i) => (
                <circle
                  key={`${c.id}-f${i}`}
                  className={css.fillet}
                  cx={cue.x}
                  cy={cue.y}
                  r={Math.max(0.4, cue.rPct)}
                  data-testid="path-fillet-cue"
                />
              ))}
            </g>
          );
        })}
        {draftPts && draftPts.length >= 1 ? (
          <g data-testid="path-corridor-draft">
            {draftPts.length >= 2 ? (
              <path
                d={pathRingToSvg(
                  pathCorridorRingPct(draftPts, draftWidthM, scaleM),
                )}
                className={css.draftFill}
                data-edge={draftEdge}
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            <path
              d={pathCentrelineToSvg(draftPts)}
              className={css.draftCentre}
              vectorEffect="non-scaling-stroke"
            />
            {pathFilletCues(draftPts, draftFilletM, scaleM).map((cue, i) => (
              <circle
                key={`draft-f${i}`}
                className={css.fillet}
                cx={cue.x}
                cy={cue.y}
                r={Math.max(0.4, cue.rPct)}
              />
            ))}
          </g>
        ) : null}
      </svg>
    </div>
  );
}
