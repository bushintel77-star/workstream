"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type {
  CatalogPlacement,
  DesignSiteFrameLevel,
  LandscapeFeature,
} from "@workstream/contracts";
import { pctToWorld, type PctPoint } from "../coordTransform";
import { useStudioStore } from "../studioStore";
import {
  deriveSurveyedPlanModel,
} from "./derive";
import type { AnnotationDialect } from "./model";
import { cfZPair } from "../../cfz";

interface AnnotationLayerToggles {
  enabled: boolean;
  propertyLines: boolean;
  elevations: boolean;
  plants: boolean;
  materials: boolean;
  callouts: boolean;
  scope: boolean;
}

function hatchPatternId(family: string, dialect: AnnotationDialect): string {
  return `anno-hatch-${family}-${dialect}`;
}

function levelPrefix(source: "existing" | "proposed"): string {
  return source === "proposed" ? "PR" : "EX";
}

export function AnnotationLayer({
  boundaryPct,
  scaleM,
  boardAspect,
  levels,
  placements,
  features,
  dialect,
  toggles,
}: {
  boundaryPct: PctPoint[];
  scaleM: number;
  boardAspect: number;
  levels: DesignSiteFrameLevel[];
  placements: CatalogPlacement[];
  features: LandscapeFeature[];
  dialect: AnnotationDialect;
  toggles: AnnotationLayerToggles;
}) {
  const zoom = useStudioStore((s) => s.liveRig.zoom);
  const density = zoom <= 0.75 ? "compact" : "full";
  const model = useMemo(
    () =>
      deriveSurveyedPlanModel({
        dialect,
        boundaryPct,
        scaleM,
        boardAspect,
        levels,
        placements,
        features,
        density,
      }),
    [dialect, boundaryPct, scaleM, boardAspect, levels, placements, features, density],
  );

  const rootRef = useRef<HTMLDivElement | null>(null);
  const boundaryRefs = useRef<Map<string, SVGLineElement | null>>(new Map());
  const boundaryLabelRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const levelRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const plantRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const calloutLeaderRefs = useRef<Map<string, SVGPolylineElement | null>>(new Map());
  const calloutBoxRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const scopeRefs = useRef<Map<string, SVGPolylineElement | null>>(new Map());
  const hatchRefs = useRef<Map<string, SVGPolygonElement | null>>(new Map());
  const northRef = useRef<HTMLDivElement | null>(null);
  const scratch = useRef(new THREE.Vector3());

  useFrame(({ camera, size }) => {
    if (!toggles.enabled) return;
    const projectPct = (point: { x: number; y: number }) => {
      const [x, z] = pctToWorld(point, scaleM, boardAspect);
      const p = scratch.current.set(x, 0.12, z).project(camera);
      return {
        x: ((p.x + 1) * size.width) / 2,
        y: ((1 - p.y) * size.height) / 2,
      };
    };

    for (const line of model.propertyLines) {
      const from = projectPct(line.fromPct);
      const to = projectPct(line.toPct);
      const lineEl = boundaryRefs.current.get(line.id);
      if (lineEl) {
        lineEl.setAttribute("x1", from.x.toFixed(1));
        lineEl.setAttribute("y1", from.y.toFixed(1));
        lineEl.setAttribute("x2", to.x.toFixed(1));
        lineEl.setAttribute("y2", to.y.toFixed(1));
      }
      const labelEl = boundaryLabelRefs.current.get(line.id);
      if (labelEl) {
        labelEl.style.transform = `translate3d(${((from.x + to.x) / 2).toFixed(1)}px, ${((from.y + to.y) / 2 - 10).toFixed(1)}px, 0)`;
      }
    }

    for (const mark of model.elevationMarks) {
      const p = projectPct(mark.atPct);
      const el = levelRefs.current.get(mark.id);
      if (el) {
        el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
      }
    }

    for (const tag of model.plantTags) {
      const p = projectPct(tag.atPct);
      const el = plantRefs.current.get(tag.id);
      if (el) {
        el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
      }
    }

    for (let idx = 0; idx < model.callouts.length; idx++) {
      const callout = model.callouts[idx]!;
      const anchor = projectPct(callout.atPct);
      const dx = idx % 2 === 0 ? 76 : -76;
      const dy = idx % 3 === 0 ? -48 : 44;
      const bubble = { x: anchor.x + dx, y: anchor.y + dy };
      const leader = calloutLeaderRefs.current.get(callout.id);
      if (leader) {
        const elbow = { x: bubble.x, y: anchor.y };
        leader.setAttribute(
          "points",
          `${anchor.x.toFixed(1)},${anchor.y.toFixed(1)} ${elbow.x.toFixed(1)},${elbow.y.toFixed(1)} ${bubble.x.toFixed(1)},${bubble.y.toFixed(1)}`,
        );
      }
      const box = calloutBoxRefs.current.get(callout.id);
      if (box) {
        box.style.transform = `translate3d(${bubble.x.toFixed(1)}px, ${bubble.y.toFixed(1)}px, 0)`;
      }
    }

    for (const scope of model.scopeOutlines) {
      const points = scope.ringPct.map((point) => projectPct(point));
      const closed = [...points, points[0]!];
      const el = scopeRefs.current.get(scope.id);
      if (el) {
        el.setAttribute(
          "points",
          closed.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "),
        );
      }
    }

    for (const hatch of model.materialHatches) {
      const points = hatch.ringPct.map((point) => projectPct(point));
      const el = hatchRefs.current.get(hatch.id);
      if (el) {
        el.setAttribute(
          "points",
          points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "),
        );
      }
    }

    if (northRef.current) {
      northRef.current.style.transform = "translate3d(16px, 56px, 0)";
    }
  });

  if (!toggles.enabled) return null;

  const style = model.styleProfile;

  return (
    <Html fullscreen zIndexRange={cfZPair("spatialAnnotation")} style={{ pointerEvents: "none" }}>
      <div ref={rootRef} style={{ position: "absolute", inset: 0 }}>
        <svg aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <defs>
            <pattern id={hatchPatternId("brick", dialect)} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="10" stroke={style.categories.material_hatch.stroke} strokeWidth="1" />
              <line x1="5" y1="0" x2="5" y2="10" stroke={style.categories.material_hatch.stroke} strokeWidth="0.7" />
            </pattern>
            <pattern id={hatchPatternId("stone", dialect)} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
              <line x1="0" y1="0" x2="0" y2="12" stroke={style.categories.material_hatch.stroke} strokeWidth="0.8" />
              <line x1="6" y1="0" x2="6" y2="12" stroke={style.categories.material_hatch.stroke} strokeWidth="0.5" />
            </pattern>
            <pattern id={hatchPatternId("gravel", dialect)} width="10" height="10" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="0.8" fill={style.categories.material_hatch.stroke} />
              <circle cx="7" cy="4" r="0.9" fill={style.categories.material_hatch.stroke} />
              <circle cx="4" cy="8" r="0.8" fill={style.categories.material_hatch.stroke} />
            </pattern>
            <pattern id={hatchPatternId("concrete", dialect)} width="12" height="12" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="12" y2="0" stroke={style.categories.material_hatch.stroke} strokeWidth="0.7" />
              <line x1="0" y1="6" x2="12" y2="6" stroke={style.categories.material_hatch.stroke} strokeWidth="0.5" />
              <line x1="0" y1="12" x2="12" y2="12" stroke={style.categories.material_hatch.stroke} strokeWidth="0.7" />
            </pattern>
            <marker id="anno-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill={style.categories.detail_callout.stroke} />
            </marker>
          </defs>
          {toggles.materials &&
            model.materialHatches.map((hatch) => (
              <polygon
                key={hatch.id}
                ref={(el) => {
                  hatchRefs.current.set(hatch.id, el);
                }}
                fill={`url(#${hatchPatternId(hatch.family, dialect)})`}
                stroke={style.categories.material_hatch.stroke}
                strokeWidth={style.categories.material_hatch.strokeWidth}
                opacity={0.75}
              />
            ))}
          {toggles.propertyLines &&
            model.propertyLines.map((line) => (
              <line
                key={line.id}
                ref={(el) => {
                  boundaryRefs.current.set(line.id, el);
                }}
                stroke={style.categories.property_line.stroke}
                strokeWidth={style.categories.property_line.strokeWidth}
                strokeLinecap="round"
              />
            ))}
          {toggles.callouts &&
            model.callouts.map((callout) => (
              <polyline
                key={callout.id}
                ref={(el) => {
                  calloutLeaderRefs.current.set(callout.id, el);
                }}
                fill="none"
                stroke={style.categories.detail_callout.stroke}
                strokeWidth={style.categories.detail_callout.strokeWidth}
                markerEnd="url(#anno-arrow)"
              />
            ))}
          {toggles.scope &&
            model.scopeOutlines.map((scope) => (
              <polyline
                key={scope.id}
                ref={(el) => {
                  scopeRefs.current.set(scope.id, el);
                }}
                fill="none"
                stroke={style.categories.scope_outline.stroke}
                strokeWidth={style.categories.scope_outline.strokeWidth}
                strokeDasharray={style.categories.scope_outline.dash ?? "6 4"}
              />
            ))}
        </svg>

        {toggles.propertyLines &&
          model.propertyLines.map((line) => (
            <div
              key={`lbl-${line.id}`}
              data-testid="annotation-boundary-label"
              ref={(el) => {
                boundaryLabelRefs.current.set(line.id, el);
              }}
              style={{
                position: "absolute",
                transform: "translate3d(0,0,0)",
                marginLeft: -78,
                width: 156,
                textAlign: "center",
                fontFamily: "var(--font-tech)",
                fontSize: "11px",
                lineHeight: 1.2,
                color: style.categories.property_line.text,
                background: "color-mix(in srgb, var(--gs-canvas) 70%, transparent)",
                border: "1px solid color-mix(in srgb, var(--gs-line) 45%, transparent)",
                borderRadius: "999px",
                padding: "1px 6px",
                whiteSpace: "nowrap",
              }}
            >
              {line.label}
            </div>
          ))}

        {toggles.elevations &&
          model.elevationMarks.map((mark) => (
            <div
              key={mark.id}
              data-testid="annotation-rl-mark"
              ref={(el) => {
                levelRefs.current.set(mark.id, el);
              }}
              style={{
                position: "absolute",
                transform: "translate3d(0,0,0)",
                marginLeft: -26,
                marginTop: -10,
                width: 52,
                textAlign: "center",
                fontFamily: "var(--font-tech)",
                fontSize: "11px",
                color: mark.source === "proposed" ? "var(--gs-primary-ink)" : "var(--gs-ink-secondary)",
                borderTop: `1px solid ${style.categories.elevation_rl.stroke}`,
                borderBottom: `1px solid ${style.categories.elevation_rl.stroke}`,
                background: "color-mix(in srgb, var(--gs-canvas) 78%, transparent)",
              }}
            >
              {levelPrefix(mark.source)} {mark.rlText}
            </div>
          ))}

        {toggles.plants &&
          model.plantTags.map((tag) => (
            <div
              key={tag.id}
              ref={(el) => {
                plantRefs.current.set(tag.id, el);
              }}
              style={{
                position: "absolute",
                transform: "translate3d(0,0,0)",
                marginLeft: -12,
                marginTop: -12,
                width: 24,
                height: 24,
                borderRadius: "999px",
                border: `1px solid ${style.categories.plant_tag.stroke}`,
                background: style.categories.plant_tag.fill ?? "var(--gs-canvas)",
                color: style.categories.plant_tag.text,
                fontFamily: "var(--font-tech)",
                fontSize: "10px",
                fontWeight: 700,
                display: "grid",
                placeItems: "center",
              }}
              aria-label={`Plant tag ${tag.code}`}
            >
              {tag.code}
            </div>
          ))}

        {toggles.callouts &&
          model.callouts.map((callout) => (
            <div
              key={`call-${callout.id}`}
              ref={(el) => {
                calloutBoxRefs.current.set(callout.id, el);
              }}
              style={{
                position: "absolute",
                transform: "translate3d(0,0,0)",
                marginLeft: -56,
                marginTop: -18,
                width: 112,
                border: `1px solid ${style.categories.detail_callout.stroke}`,
                background: "color-mix(in srgb, var(--gs-canvas) 84%, transparent)",
                color: style.categories.detail_callout.text,
                borderRadius: 6,
                padding: "3px 6px",
                fontFamily: "var(--font-ui)",
                fontSize: "11px",
                lineHeight: 1.25,
              }}
            >
              <strong style={{ fontFamily: "var(--font-tech)" }}>{callout.detailId}</strong>{" "}
              {callout.text}
            </div>
          ))}

        {toggles.scope &&
          model.scopeOutlines.map((scope) => (
            <div
              key={`scope-label-${scope.id}`}
              style={{
                position: "absolute",
                left: "50%",
                top: "80%",
                transform: "translate(-50%, -50%)",
                border: `1px dashed ${style.categories.scope_outline.stroke}`,
                color: style.categories.scope_outline.text,
                background: "color-mix(in srgb, var(--gs-canvas) 84%, transparent)",
                borderRadius: 6,
                fontFamily: "var(--font-tech)",
                fontSize: "11px",
                padding: "2px 6px",
              }}
            >
              {scope.label}
            </div>
          ))}

        <div
          ref={northRef}
          aria-label="North orientation"
          style={{
            position: "absolute",
            color: "var(--gs-ink-secondary)",
            fontFamily: "var(--font-tech)",
            fontSize: "12px",
            border: "1px solid color-mix(in srgb, var(--gs-line) 45%, transparent)",
            borderRadius: "999px",
            width: 30,
            height: 30,
            display: "grid",
            placeItems: "center",
            background: "color-mix(in srgb, var(--gs-canvas) 75%, transparent)",
          }}
        >
          N↑
        </div>
      </div>
    </Html>
  );
}
