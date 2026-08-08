"use client";

import { useEffect, useState } from "react";
import type { LandscapeFeature } from "@workstream/contracts";
import {
  buildLandscapeFeatureFromStroke,
  defaultStructuredToolProps,
  type StructuredToolKind,
} from "@workstream/domain";
import css from "./structuredToolOverlay.module.css";

const TOOLS: StructuredToolKind[] = ["ditch", "path", "wall", "bed"];

type Props = {
  active: boolean;
  onFeature: (feature: LandscapeFeature) => void;
  paper?: boolean;
};

export function StructuredToolOverlay({ active, onFeature, paper }: Props) {
  const [kind, setKind] = useState<StructuredToolKind | null>(null);
  const [draft, setDraft] = useState<Array<{ x_pct: number; y_pct: number }>>(
    [],
  );

  useEffect(() => {
    if (!active) {
      setKind(null);
      setDraft([]);
    }
  }, [active]);

  useEffect(() => {
    if (!kind) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setKind(null);
        setDraft([]);
      }
      if (e.key === "Enter" && draft.length >= 2) {
        const feature = buildLandscapeFeatureFromStroke({ kind, points: draft });
        onFeature(feature);
        setDraft([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kind, draft, onFeature]);

  if (!active) return null;

  const props = kind ? defaultStructuredToolProps(kind) : null;
  const minPts = kind === "bed" ? 3 : 2;

  return (
    <>
      {kind ? (
        <div
          className={css.capture}
          data-testid="structured-tool-capture"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x_pct = ((e.clientX - rect.left) / rect.width) * 100;
            const y_pct = ((e.clientY - rect.top) / rect.height) * 100;
            const next = [
              ...draft,
              {
                x_pct: Math.min(100, Math.max(0, x_pct)),
                y_pct: Math.min(100, Math.max(0, y_pct)),
              },
            ];
            setDraft(next);
            if (next.length >= minPts && e.detail === 2) {
              const feature = buildLandscapeFeatureFromStroke({
                kind,
                points: next,
              });
              onFeature(feature);
              setDraft([]);
            }
          }}
        >
          <svg className={css.svg} viewBox="0 0 100 100" preserveAspectRatio="none">
            {draft.length > 0 ? (
              <polyline
                fill={kind === "bed" ? "rgba(194,69,95,0.12)" : "none"}
                stroke="#C2455F"
                strokeWidth="0.6"
                points={draft.map((p) => `${p.x_pct},${p.y_pct}`).join(" ")}
              />
            ) : null}
            {draft.map((p, i) => (
              <circle key={i} cx={p.x_pct} cy={p.y_pct} r="0.9" fill="#C2455F" />
            ))}
          </svg>
        </div>
      ) : null}
      <div
        className={`${css.wrap}${paper ? ` ${css.paper}` : ""}`}
        data-testid="structured-tool-bar"
      >
        <p className={css.kicker}>Structured tools</p>
        <div className={css.tools}>
          {TOOLS.map((t) => (
            <button
              key={t}
              type="button"
              className={`${css.btn}${kind === t ? ` ${css.btnActive}` : ""}`}
              data-testid={`structured-tool-${t}`}
              aria-pressed={kind === t}
              onClick={() => {
                setKind((prev) => (prev === t ? null : t));
                setDraft([]);
              }}
            >
              {t}
            </button>
          ))}
        </div>
        {kind ? (
          <p className={css.hint}>
            Click canvas ({draft.length} pts) · {props!.width_m || "—"}×
            {props!.depth_m} m · Enter to commit · Esc cancel
          </p>
        ) : (
          <p className={css.hint}>Pick ditch, path, wall or bed.</p>
        )}
      </div>
    </>
  );
}
