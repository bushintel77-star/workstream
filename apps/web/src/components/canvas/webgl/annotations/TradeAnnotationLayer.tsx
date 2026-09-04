"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { CatalogPlacement, ConstructionTrench, IrrigationZone, LandscapeFeature } from "@workstream/contracts";
import type { AnnotationDialect } from "./model";
import { cfZPair } from "../../cfz";
import { pctToWorld, type PctPoint } from "../coordTransform";
import { deriveTradePackModel } from "./tradeDerive";
import type { TradePackId } from "./tradeModel";
import { useStudioStore } from "../studioStore";

const TRADE_STYLE: Record<TradePackId, { stroke: string; dash?: string; width: number }> = {
  irrigationDrainage: { stroke: "var(--ws-ink)", dash: "7 3", width: 1.2 },
  hardscapeConstruction: { stroke: "var(--ws-ink)", width: 1.35 },
  lightingElectrical: { stroke: "var(--ws-active)", dash: "2 3", width: 1.15 },
};

export function TradeAnnotationLayer({
  boundaryPct,
  scaleM,
  boardAspect,
  dialect,
  packs,
  trenches,
  zones,
  features,
  placements,
}: {
  boundaryPct: PctPoint[];
  scaleM: number;
  boardAspect: number;
  dialect: AnnotationDialect;
  packs: {
    irrigationDrainage: boolean;
    hardscapeConstruction: boolean;
    lightingElectrical: boolean;
  };
  trenches: ConstructionTrench[];
  zones: IrrigationZone[];
  features: LandscapeFeature[];
  placements: CatalogPlacement[];
}) {
  const zoom = useStudioStore((s) => s.liveRig.zoom);
  const scratch = useRef(new THREE.Vector3());
  const lineRefs = useRef(new Map<string, SVGPolylineElement | null>());
  const calloutRefs = useRef(new Map<string, HTMLDivElement | null>());
  const leaderRefs = useRef(new Map<string, SVGPolylineElement | null>());

  const model = useMemo(
    () =>
      deriveTradePackModel({
        dialect,
        packs,
        trenches,
        zones,
        features,
        placements,
        density: zoom <= 0.75 ? "compact" : "full",
      }),
    [dialect, packs, trenches, zones, features, placements, zoom],
  );

  useFrame(({ camera, size }) => {
    const project = (point: { x: number; y: number }) => {
      const [x, z] = pctToWorld(point, scaleM, boardAspect);
      const p = scratch.current.set(x, 0.08, z).project(camera);
      return { x: ((p.x + 1) * size.width) / 2, y: ((1 - p.y) * size.height) / 2 };
    };
    for (const line of model.lines) {
      const points = line.pointsPct.map(project);
      const closed = points.length > 2 ? [...points, points[0]!] : points;
      const ref = lineRefs.current.get(line.id);
      if (ref) {
        ref.setAttribute(
          "points",
          closed.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "),
        );
      }
    }
    for (let i = 0; i < model.callouts.length; i++) {
      const callout = model.callouts[i]!;
      const a = project(callout.atPct);
      const b = { x: a.x + (i % 2 === 0 ? 84 : -84), y: a.y + (i % 3 === 0 ? -44 : 40) };
      const leader = leaderRefs.current.get(callout.id);
      if (leader) {
        leader.setAttribute("points", `${a.x.toFixed(1)},${a.y.toFixed(1)} ${b.x.toFixed(1)},${a.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`);
      }
      const ref = calloutRefs.current.get(callout.id);
      if (ref) {
        ref.style.transform = `translate3d(${b.x.toFixed(1)}px, ${b.y.toFixed(1)}px, 0)`;
      }
    }
  });

  if (boundaryPct.length < 3) return null;

  return (
    <Html fullscreen zIndexRange={cfZPair("spatialAnnotation")} style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: 0 }}>
        <svg aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <defs>
            <marker id="trade-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="var(--ws-ink)" />
            </marker>
          </defs>
          {model.lines.map((line) => {
            const style = TRADE_STYLE[line.pack];
            return (
              <polyline
                key={line.id}
                ref={(el) => {
                  lineRefs.current.set(line.id, el);
                }}
                fill="none"
                data-trade-pack={line.pack}
                stroke={style.stroke}
                strokeDasharray={style.dash}
                strokeWidth={style.width}
                opacity={0.88}
              />
            );
          })}
          {model.callouts.map((callout) => (
            <polyline
              key={`lead-${callout.id}`}
              ref={(el) => {
                leaderRefs.current.set(callout.id, el);
              }}
              fill="none"
              stroke={TRADE_STYLE[callout.pack].stroke}
              strokeWidth={1}
              markerEnd="url(#trade-arrow)"
            />
          ))}
        </svg>
        {model.callouts.map((callout) => (
          <div
            key={callout.id}
            ref={(el) => {
              calloutRefs.current.set(callout.id, el);
            }}
            data-testid={`trade-callout-${callout.pack}`}
            data-trade-pack={callout.pack}
            style={{
              position: "absolute",
              transform: "translate3d(0,0,0)",
              marginLeft: -62,
              marginTop: -18,
              width: 124,
              borderRadius: 4,
              border: `1px solid ${TRADE_STYLE[callout.pack].stroke}`,
              background: "color-mix(in srgb, var(--ws-canvas) 86%, transparent)",
              color: "var(--ws-ink)",
              fontFamily: "var(--font-ui)",
              fontSize: "11px",
              lineHeight: 1.25,
              padding: "3px 6px",
            }}
          >
            <strong style={{ fontFamily: "var(--font-tech)" }}>{callout.code}</strong>{" "}
            {callout.text}
          </div>
        ))}
      </div>
    </Html>
  );
}
