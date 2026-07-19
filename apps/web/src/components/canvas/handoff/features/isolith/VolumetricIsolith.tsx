"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildIsolithSurvey,
  isolithRingRadii,
  type IsolithMaterial,
  type IsolithMaterialKind,
  type StudioEstimateReport,
} from "@workstream/domain";
import css from "./volumetricIsolith.module.css";

type Props = {
  estimate: StudioEstimateReport;
  /** Shift toward dig point while Add/Edit hardscape. */
  proximity?: boolean;
};

const KIND_CLASS: Record<IsolithMaterialKind, string> = {
  topsoil: css.kindTopsoil!,
  crushed_rock: css.kindRock!,
  excavated_clay: css.kindClay!,
};

function GrainPattern({
  id,
  grain,
}: {
  id: string;
  grain: IsolithMaterial["grain"];
}) {
  if (grain === "hatch") {
    return (
      <pattern
        id={id}
        width="5"
        height="5"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(35)"
      >
        <path d="M0 0L5 5" stroke="currentColor" strokeWidth="0.45" />
        <path d="M2.5 0L5 2.5" stroke="currentColor" strokeWidth="0.35" />
      </pattern>
    );
  }
  if (grain === "wave") {
    return (
      <pattern
        id={id}
        width="8"
        height="6"
        patternUnits="userSpaceOnUse"
      >
        <path
          d="M0 3Q2 1 4 3T8 3"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.4"
        />
      </pattern>
    );
  }
  return (
    <pattern id={id} width="4" height="4" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1.2" r="0.45" fill="currentColor" />
      <circle cx="3.1" cy="2.8" r="0.35" fill="currentColor" />
    </pattern>
  );
}

/**
 * Dynamic Volumetric Isolith — micro-topographic stockpile on the sheet margin.
 * Compact contour + volume tag; click expands bank / bulkage / truck ledger.
 */
export function VolumetricIsolith({ estimate, proximity }: Props) {
  const survey = useMemo(() => buildIsolithSurvey(estimate), [estimate]);
  const [kind, setKind] = useState<IsolithMaterialKind | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!survey.primaryKind) {
      setKind(null);
      setExpanded(false);
      return;
    }
    setKind((prev) =>
      prev && survey.materials.some((m) => m.kind === prev)
        ? prev
        : survey.primaryKind,
    );
  }, [survey.primaryKind, survey.materials]);

  const active =
    survey.materials.find((m) => m.kind === kind) ?? survey.materials[0];
  if (!active) return null;

  const rings = isolithRingRadii(active.intensity);
  const footprint = 52 + active.intensity * 58;
  const patternId = `isolith-grain-${active.kind}`;

  return (
    <aside
      className={`${css.root}${proximity ? ` ${css.proximity}` : ""}${
        expanded ? ` ${css.expanded}` : ""
      }`}
      data-testid="volumetric-isolith"
      data-kind={active.kind}
      onMouseLeave={() => setExpanded(false)}
    >
      <button
        type="button"
        className={`${css.pile} ${KIND_CLASS[active.kind]}`}
        data-testid="isolith-pile"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        title="Stockpile survey — click for ledger"
      >
        <span className={css.label}>{active.label}</span>
        <svg
          className={css.svg}
          width={footprint}
          height={footprint * 0.72}
          viewBox="0 0 100 72"
          aria-hidden
          data-intensity={active.intensity.toFixed(2)}
        >
          <defs>
            <GrainPattern id={patternId} grain={active.grain} />
          </defs>
          {/* Drafting stack: grain → contours → core (SDS §5.2) */}
          <g data-isolith-layer="grain">
            <ellipse
              cx="50"
              cy="40"
              rx={48 * (0.72 + active.intensity * 0.22)}
              ry={28 * (0.72 + active.intensity * 0.22)}
              fill={`url(#${patternId})`}
              opacity={0.22 + active.intensity * 0.18}
            />
          </g>
          <g data-isolith-layer="contours">
            {rings.map((r, i) => (
              <ellipse
                key={`${r}-${i}`}
                className={css.ring}
                cx="50"
                cy="40"
                rx={48 * r}
                ry={28 * r}
                fill="none"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
          <g data-isolith-layer="core">
            <ellipse
              className={css.core}
              cx="50"
              cy="40"
              rx={10 + active.intensity * 8}
              ry={6 + active.intensity * 5}
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        </svg>
        <span className={css.tag} data-testid="isolith-volume-tag">
          {active.looseM3.toFixed(2)} m³
        </span>
      </button>

      {survey.materials.length > 1 ? (
        <div className={css.tabs} role="tablist" aria-label="Stockpile material">
          {survey.materials.map((m) => (
            <button
              key={m.kind}
              type="button"
              role="tab"
              aria-selected={m.kind === active.kind}
              className={`${css.tab}${
                m.kind === active.kind ? ` ${css.tabActive}` : ""
              }`}
              data-testid={`isolith-tab-${m.kind}`}
              onClick={() => {
                setKind(m.kind);
                setExpanded(true);
              }}
            >
              {m.kind === "topsoil"
                ? "Topsoil"
                : m.kind === "crushed_rock"
                  ? "CR6"
                  : "Clay"}
            </button>
          ))}
        </div>
      ) : null}

      {expanded ? (
        <div className={css.ledger} data-testid="isolith-ledger">
          <p className={css.ledgerTitle}>
            {active.label} · AI surveyed
          </p>
          <dl className={css.rows}>
            <div>
              <dt>Volume (bank)</dt>
              <dd>{active.bankM3.toFixed(2)} m³</dd>
            </div>
            <div>
              <dt>Bulkage factor</dt>
              <dd>
                {active.bulkageFactor.toFixed(2)}{" "}
                <span className={css.note}>({active.bulkageNote})</span>
              </dd>
            </div>
            <div>
              <dt>Volume (loose / truck)</dt>
              <dd>{active.looseM3.toFixed(2)} m³</dd>
            </div>
            <div>
              <dt>Est. truckloads</dt>
              <dd>{active.truckLoads.toFixed(1)} (standard 8 m³)</dd>
            </div>
            <div>
              <dt>Depth rule</dt>
              <dd>{active.depthRuleMm} mm</dd>
            </div>
          </dl>
          <p className={css.honesty}>{survey.honesty}</p>
        </div>
      ) : null}
    </aside>
  );
}
