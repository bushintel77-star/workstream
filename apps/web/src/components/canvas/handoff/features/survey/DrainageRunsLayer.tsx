"use client";

import { buildDrainageFallCues, type DrainageRun } from "@workstream/domain";
import css from "./drainageRuns.module.css";

type Level = { x: number; y: number; z: number };

type Props = {
  runs: DrainageRun[];
  levels: Level[];
  selectedIdx: number[];
  scaleM: number;
  onToggleLevel: (idx: number) => void;
  onCommitRun: () => void;
};

/** Indicative drainage runs + spot RL multi-select for linking. */
export function DrainageRunsLayer({
  runs,
  levels,
  selectedIdx,
  scaleM,
  onToggleLevel,
  onCommitRun,
}: Props) {
  return (
    <div className={css.layer} data-testid="drainage-runs-layer" aria-hidden>
      <svg className={css.svg} viewBox="0 0 100 100" preserveAspectRatio="none">
        {runs.map((run) => {
          const cues = buildDrainageFallCues(run, scaleM);
          const pts = run.points;
          if (pts.length < 2) return null;
          const d = pts
            .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
            .join(" ");
          return (
            <g key={run.id} data-testid="drainage-run">
              <path
                d={d}
                className={css.run}
                vectorEffect="non-scaling-stroke"
              />
              {cues.map((c, i) => {
                const mx = (c.from.x + c.to.x) / 2;
                const my = (c.from.y + c.to.y) / 2;
                const ang =
                  (Math.atan2(c.to.y - c.from.y, c.to.x - c.from.x) * 180) /
                  Math.PI;
                return (
                  <g key={`${run.id}-f${i}`}>
                    <polygon
                      className={css.fallArrow}
                      data-adverse={c.adverse ? "true" : "false"}
                      points="-1.2,-0.7 1.4,0 -1.2,0.7"
                      transform={`translate(${mx} ${my}) rotate(${ang})`}
                    />
                    <text
                      x={mx}
                      y={my - 1.6}
                      className={css.fallLabel}
                      data-adverse={c.adverse ? "true" : "false"}
                    >
                      {c.fallPct.toFixed(1)}%
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      {levels.map((lv, idx) => (
        <button
          key={`lv-${idx}`}
          type="button"
          className={css.levelHit}
          style={{ left: `${lv.x}%`, top: `${lv.y}%` }}
          data-selected={selectedIdx.includes(idx) ? "true" : "false"}
          data-testid={`drainage-level-${idx}`}
          onClick={() => onToggleLevel(idx)}
          aria-label={`Select RL ${lv.z.toFixed(2)} for drainage run`}
        />
      ))}
      {selectedIdx.length >= 2 ? (
        <button
          type="button"
          className={css.commit}
          data-testid="drainage-commit-run"
          onClick={onCommitRun}
        >
          Link {selectedIdx.length} RLs → drainage run
        </button>
      ) : null}
    </div>
  );
}
