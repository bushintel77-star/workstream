"use client";

import type { HeroBoundary } from "../../lib/landingGeo";
import { HERO_IMAGE_H, HERO_IMAGE_W } from "../../lib/landingGeo";
import css from "../../app/landing.module.css";

type Point = readonly [number, number];

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
};

function boundsOf(ring: ReadonlyArray<Point>): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}

function points(ring: ReadonlyArray<Point>): string {
  return ring.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
}

function frameFor(boundary: Bounds): Bounds {
  const padding = Math.max(72, Math.min(180, Math.max(boundary.width, boundary.height) * 0.22));
  return {
    minX: Math.max(0, boundary.minX - padding),
    minY: Math.max(0, boundary.minY - padding),
    maxX: Math.min(HERO_IMAGE_W, boundary.maxX + padding),
    maxY: Math.min(HERO_IMAGE_H, boundary.maxY + padding),
    width: Math.min(HERO_IMAGE_W, boundary.maxX + padding) - Math.max(0, boundary.minX - padding),
    height: Math.min(HERO_IMAGE_H, boundary.maxY + padding) - Math.max(0, boundary.minY - padding),
    cx: boundary.cx,
    cy: boundary.cy,
  };
}

function curvedLeader(
  label: Point,
  anchor: Point,
  side: "left" | "right",
): string {
  const direction = side === "left" ? 1 : -1;
  const bend = Math.max(35, Math.abs(anchor[0] - label[0]) * 0.42);
  return `M ${label[0].toFixed(1)},${label[1].toFixed(1)} C ${(label[0] + direction * bend).toFixed(1)},${label[1].toFixed(1)} ${(anchor[0] - direction * bend).toFixed(1)},${anchor[1].toFixed(1)} ${anchor[0].toFixed(1)},${anchor[1].toFixed(1)}`;
}

export interface HeroSiteAnalysisOverlayProps {
  boundary: HeroBoundary | null;
  aerialUrl: string;
  locationLabel: string;
}

export function HeroSiteAnalysisOverlay({
  boundary,
  aerialUrl,
  locationLabel,
}: HeroSiteAnalysisOverlayProps) {
  if (!boundary || boundary.polygon.length < 3) return null;

  const titleBounds = boundsOf(boundary.polygon);
  const buildingBounds = boundary.building && boundary.building.length >= 3
    ? boundsOf(boundary.building)
    : null;
  const frame = frameFor(titleBounds);
  const leftLabelX = frame.minX + frame.width * 0.06;
  const rightLabelX = frame.maxX - frame.width * 0.06;
  const titleAnchor: Point = [titleBounds.maxX - titleBounds.width * 0.18, titleBounds.minY + titleBounds.height * 0.08];
  const buildingAnchor: Point | null = buildingBounds
    ? [buildingBounds.cx, buildingBounds.cy]
    : null;
  const titleLabel: Point = [leftLabelX, frame.minY + frame.height * 0.2];
  const buildingLabel: Point = [rightLabelX, frame.maxY - frame.height * 0.2];
  const northX = frame.maxX - frame.width * 0.1;
  const northY = frame.minY + frame.height * 0.12;
  const viewBox = `${frame.minX} ${frame.minY} ${frame.width} ${frame.height}`;

  return (
    <section className={css.siteAnalysis} data-testid="hero-site-analysis" aria-label="Live site analysis">
      <div className={css.siteAnalysisHeader}>
        <div>
          <span className={css.siteAnalysisKicker}>WORKSTREAM / SURVEY</span>
          <h2 className={css.siteAnalysisTitle}>SITE ANALYSIS</h2>
        </div>
        <span className={css.siteAnalysisIndex}>01 / LIVE</span>
      </div>
      <svg
        className={css.siteAnalysisSvg}
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Live site analysis for ${locationLabel}`}
      >
        <defs>
          <pattern id="hero-analysis-grid" width="34" height="34" patternUnits="userSpaceOnUse">
            <path d="M 34 0 L 0 0 0 34" className={css.siteAnalysisGridLine} />
          </pattern>
          <filter id="hero-analysis-soften" x="-10%" y="-10%" width="120%" height="120%">
            <feColorMatrix type="saturate" values="0.35" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.68" />
            </feComponentTransfer>
          </filter>
        </defs>
        <rect x={frame.minX} y={frame.minY} width={frame.width} height={frame.height} className={css.siteAnalysisPanel} />
        <image
          href={aerialUrl}
          x={0}
          y={0}
          width={HERO_IMAGE_W}
          height={HERO_IMAGE_H}
          preserveAspectRatio="none"
          className={css.siteAnalysisAerial}
          filter="url(#hero-analysis-soften)"
        />
        <rect x={frame.minX} y={frame.minY} width={frame.width} height={frame.height} fill="url(#hero-analysis-grid)" className={css.siteAnalysisGrid} />
        <path d={`M ${points(boundary.polygon)} Z`} className={css.siteAnalysisBoundary} />
        {boundary.building && boundary.building.length >= 3 ? (
          <path d={`M ${points(boundary.building)} Z`} className={css.siteAnalysisBuilding} />
        ) : null}
        <path d={curvedLeader(titleLabel, titleAnchor, "left")} className={css.siteAnalysisLeader} />
        {buildingAnchor ? (
          <>
            <path d={curvedLeader(buildingLabel, buildingAnchor, "right")} className={css.siteAnalysisLeader} />
            <circle cx={buildingAnchor[0]} cy={buildingAnchor[1]} r="5" className={css.siteAnalysisAnchor} />
            <text x={buildingLabel[0]} y={buildingLabel[1]} className={css.siteAnalysisAnnotation} textAnchor="end">EXISTING FOOTPRINT</text>
            <text x={buildingLabel[0]} y={buildingLabel[1] + 24} className={css.siteAnalysisSubannotation} textAnchor="end">BUILDING / VERIFIED</text>
          </>
        ) : null}
        <text x={titleLabel[0]} y={titleLabel[1]} className={css.siteAnalysisAnnotation} textAnchor="start">TITLE / LIVE</text>
        <text x={titleLabel[0]} y={titleLabel[1] + 24} className={css.siteAnalysisSubannotation} textAnchor="start">VICMAP CADASTRE</text>
        <g className={css.siteAnalysisNorth} transform={`translate(${northX} ${northY})`}>
          <path d="M 0 26 L 0 -18 M 0 -18 L -7 -5 M 0 -18 L 7 -5" />
          <text x="0" y="42" textAnchor="middle">N</text>
        </g>
      </svg>
      <div className={css.siteAnalysisFooter}>
        <span>{locationLabel}</span>
        <span>{buildingBounds ? "BOUNDARY + BUILDING / LIVE DATA" : "BOUNDARY / LIVE DATA"}</span>
      </div>
    </section>
  );
}
