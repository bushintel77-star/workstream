"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  buildHeroAerialUrlFor,
  HERO_ADDRESS,
  HERO_IMAGE_H,
  HERO_IMAGE_W,
  HERO_PIN,
  loadHeroBoundary,
  pinDmsLabel,
  ringCentroidPct,
  type GeoPin,
  type HeroBoundary,
} from "../../lib/landingGeo";
import {
  HeroAddressEntry,
  type AddressSuggestion,
} from "./HeroAddressEntry";
import css from "../../app/landing.module.css";

type BoundaryState = "pending" | "live" | "unavailable";

const WORKFLOW = [
  {
    num: "01",
    title: "Live GIS Ingest",
    body: "Auto-stream Vicmap cadastral, SPI, zoning overlays, and 0.5m contours straight to your coordinates.",
  },
  {
    num: "02",
    title: "Tactile Vector Sketching",
    body: "6B graphite feel, CAD precision. Background vectorization captures pressure, tilt, and azimuth.",
  },
  {
    num: "03",
    title: "Infinite 2D/3D Canvas",
    body: "Project flat plans into 3D with real-time solar tracking and canopy shadows.",
  },
  {
    num: "04",
    title: "Pop-Free LOD",
    body: "Seamless scale-band cross-fading from 1:1 concept sketches to 1:400 site plans.",
  },
  {
    num: "05",
    title: "Parametric Quoting",
    body: "Real-time takeoffs. Sketch a polygon, get instant m², volumes, plant counts, and live costs.",
  },
  {
    num: "06",
    title: "One-Click Sections",
    body: "Instant elevation profiles, ground slopes, mature heights, and setback checks.",
  },
  {
    num: "07",
    title: "Spatial UI",
    body: "80/20 floating glass chrome. Maximum canvas, zero toolbar clutter.",
  },
  {
    num: "08",
    title: "Client Portal",
    body: "Frosted-glass 3D walkthroughs, quote approval, and deposit capture.",
  },
] as const;

/** Polygon ring → SVG points string (already in hero-image pixel space). */
function toPoints(ring: ReadonlyArray<readonly [number, number]>): string {
  return ring.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
}

/** Dedupe the closing vertex for the corner-dot markers. */
function cornerVertices(
  ring: ReadonlyArray<readonly [number, number]>,
): readonly (readonly [number, number])[] {
  if (ring.length < 2) return ring.slice();
  const [fx, fy] = ring[0]!;
  const [lx, ly] = ring[ring.length - 1]!;
  const closed = Math.abs(fx - lx) < 1e-6 && Math.abs(fy - ly) < 1e-6;
  return closed ? ring.slice(0, -1) : ring.slice();
}

type FeatureLegend = {
  x: number;
  y: number;
  label: string;
  tickTo: [number, number];
};

/**
 * The hero property's features, hand-written beside the REAL title polygon:
 * a stacked legend with short hand ticks. Every label is imagery- or
 * registry-verified for this property (pool + gardens pixel-probed on the
 * sub-metre aerial; the boundary is the live polygon itself).
 */
function featureLayout(
  poly: ReadonlyArray<readonly [number, number]>,
): FeatureLegend[] {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = Math.max(maxX - minX, 40);
  const h = Math.max(maxY - minY, 40);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const s = Math.min(Math.max((w + h) / 2 / 210, 0.8), 1.4);
  const gap = 46 * s;
  const entries = [
    { label: "swimming pool", to: [cx + w * 0.24, cy + h * 0.22] as [number, number] },
    { label: "landscaped gardens", to: [cx - w * 0.2, cy + h * 0.28] as [number, number] },
    { label: "live title boundary", to: [cx, minY + h * 0.06] as [number, number] },
  ];
  const x = maxX + 34 * s;
  const y0 = cy - gap;
  return entries.map((e, i) => ({
    x,
    y: y0 + i * gap,
    label: e.label,
    tickTo: e.to,
  }));
}

/** Deterministic 0–1 hash — sketch wobble stays stable across renders. */
function wobble01(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function ringBoundsPx(
  ring: ReadonlyArray<readonly [number, number]>,
): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const w = maxX - minX;
  const h = maxY - minY;
  return {
    minX,
    minY,
    maxX,
    maxY,
    w,
    h,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}

function centroidPx(
  ring: ReadonlyArray<readonly [number, number]>,
): [number, number] {
  let ax = 0;
  let ay = 0;
  for (const [x, y] of ring) {
    ax += x;
    ay += y;
  }
  const n = ring.length;
  return n > 0 ? [ax / n, ay / n] : [0, 0];
}

/** A hand-drawn closed path — vertices nudged by a stable wobble. */
function sketchClosed(
  pts: ReadonlyArray<readonly [number, number]>,
  seed: number,
  amp: number,
): string {
  const d = pts
    .map(([x, y], i) => {
      const nx = x + (wobble01(seed + i * 0.53) - 0.5) * amp;
      const ny = y + (wobble01(seed + i * 0.61 + 9.7) - 0.5) * amp;
      return `${nx.toFixed(1)},${ny.toFixed(1)}`;
    })
    .join(" L ");
  return `M ${d} Z`;
}

/** A hand-drawn open line. */
function sketchOpen(
  pts: ReadonlyArray<readonly [number, number]>,
  seed: number,
  amp: number,
): string {
  const d = pts
    .map(([x, y], i) => {
      const nx = x + (wobble01(seed + i * 0.71) - 0.5) * amp;
      const ny = y + (wobble01(seed + i * 0.83 + 3.1) - 0.5) * amp;
      return `${nx.toFixed(1)},${ny.toFixed(1)}`;
    })
    .join(" L ");
  return `M ${d}`;
}

/** A hand-drawn circle — radius wobble + closed seam. */
function sketchCircle(cx: number, cy: number, r: number, seed: number): string {
  const pts: Array<[number, number]> = [];
  const segs = 30;
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const rr = r + (wobble01(seed + i * 0.37) - 0.5) * r * 0.18;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return sketchClosed(pts, seed, r * 0.02);
}

type PreSketchMark = {
  kind: "zone" | "canopy" | "deck";
  d: string;
};

type PreSketch = {
  marks: PreSketchMark[];
  hatches: string[];
  path: string | null;
  labels: Array<{ x: number; y: number; text: string }>;
};

/**
 * The pre-sketch — design-intent marks hand-drawn over the SURVEY state,
 * anchored to the REAL title polygon (and its building footprint when the
 * registry returns one): a lawn mass with chalk hatch, two canopy blobs, a
 * deck hugging the building, and a path. Every mark is deterministic
 * (stable across renders) and LOCATIONAL-INDICATIVE — the on-frame stamp
 * names it a pre-sketch, and it only ever renders on the default hero
 * property, never over a picked client address (no fabricated design on a
 * real client's property).
 */
function buildPreSketch(
  poly: ReadonlyArray<readonly [number, number]>,
  building: ReadonlyArray<readonly [number, number]> | null,
): PreSketch | null {
  if (poly.length < 3) return null;
  const b = ringBoundsPx(poly);
  const size = (b.w + b.h) / 2;
  if (!(size > 0)) return null;

  const anchor =
    building && building.length >= 3 ? ringBoundsPx(building) : null;
  const bcx = anchor ? anchor.cx : b.cx;
  const bcy = anchor ? anchor.cy : b.cy;
  const [pcx, pcy] = centroidPx(poly);

  // Garden direction — polygon centroid away from the building.
  let dx = pcx - bcx;
  let dy = pcy - bcy;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  const px = -dy; // perpendicular
  const py = dx;

  const marks: PreSketchMark[] = [];
  const labels: Array<{ x: number; y: number; text: string }> = [];

  // Lawn mass — a wobbled six-point zone in the garden direction.
  const lawnCx = bcx + dx * size * 0.3;
  const lawnCy = bcy + dy * size * 0.3;
  const lawnR = size * 0.24;
  const lawnPts: Array<[number, number]> = Array.from(
    { length: 6 },
    (_, i): [number, number] => {
      const a = (i / 6) * Math.PI * 2 + 0.5;
      const rr = lawnR * (0.72 + 0.28 * wobble01(i * 3.1 + 1));
      return [lawnCx + Math.cos(a) * rr, lawnCy + Math.sin(a) * rr];
    },
  );
  marks.push({ kind: "zone", d: sketchClosed(lawnPts, 41, size * 0.03) });
  labels.push({ x: lawnCx, y: lawnCy - lawnR * 0.6, text: "proposed lawn" });

  // Two canopy blobs flanking the lawn.
  for (let k = 0; k < 2; k++) {
    const side = k === 0 ? 1 : -1;
    const ccx = lawnCx + px * side * size * 0.16 + dx * size * 0.12;
    const ccy = lawnCy + py * side * size * 0.16 + dy * size * 0.08;
    marks.push({
      kind: "canopy",
      d: sketchCircle(ccx, ccy, size * 0.11, 71 + k * 13),
    });
  }
  labels.push({
    x: lawnCx + px * size * 0.16 + dx * size * 0.12,
    y: lawnCy + py * size * 0.16 + dy * size * 0.08,
    text: "canopy",
  });

  // Deck — a small wobbled square hugging the building on the garden side.
  const deckR = size * 0.09;
  const gap = anchor ? Math.max(anchor.h, anchor.w) * 0.5 : size * 0.1;
  const deckCx = bcx + dx * (gap + deckR);
  const deckCy = bcy + dy * (gap + deckR);
  const deckPts: Array<[number, number]> = [
    [deckCx - deckR, deckCy - deckR],
    [deckCx + deckR, deckCy - deckR],
    [deckCx + deckR, deckCy + deckR],
    [deckCx - deckR, deckCy + deckR],
  ];
  marks.push({ kind: "deck", d: sketchClosed(deckPts, 7, size * 0.02) });
  labels.push({ x: deckCx + deckR * 1.45, y: deckCy + 6, text: "deck" });

  // Path — a wobbled line from the building edge toward the lawn.
  const path = sketchOpen(
    [
      [
        bcx + dx * (anchor ? gap * 0.55 : size * 0.06),
        bcy + dy * (anchor ? gap * 0.55 : size * 0.06),
      ],
      [bcx + dx * size * 0.14, bcy + dy * size * 0.14],
    ],
    31,
    size * 0.02,
  );

  // Hatch — parallel chalk lines inside the lawn zone.
  const hatches: string[] = [];
  for (let h = 0; h < 4; h++) {
    hatches.push(
      sketchOpen(
        [
          [lawnCx - lawnR * 0.55 + h * lawnR * 0.36, lawnCy - lawnR * 0.42],
          [
            lawnCx - lawnR * 0.55 + h * lawnR * 0.36 - lawnR * 0.4,
            lawnCy - lawnR * 0.42 + lawnR * 0.5,
          ],
        ],
        90 + h,
        size * 0.015,
      ),
    );
  }

  return { marks, hatches, path, labels };
}

/**
 * The landing hero carries the studio's pitch over the real frame: a live
 * Stonnington aerial, one lit property, a live Vicmap title boundary, and
 * the promise — from GIS ingest to client sign-off. Type an address and the
 * hero re-centres on YOUR property and draws ITS boundary; the entry and
 * the CTA both lead into the studio. Every claim on the page is a feature
 * the studio ships — no mock data, no fabricated telemetry.
 */
export function LandingCanvas({
  aerialUrl: initialAerialUrl,
  aerialLowUrl: initialAerialLowUrl,
}: {
  aerialUrl: string;
  aerialLowUrl: string;
}) {
  const router = useRouter();
  const heroRef = useRef<HTMLElement | null>(null);
  const boundaryRequestRef = useRef(0);
  const [pin, setPin] = useState<GeoPin>(HERO_PIN);
  const [addressLabel, setAddressLabel] = useState<string | null>(null);
  const [chosen, setChosen] = useState<AddressSuggestion | null>(null);
  const [aerialUrl, setAerialUrl] = useState(initialAerialUrl);
  const [aerialLowUrl, setAerialLowUrl] = useState(initialAerialLowUrl);
  const [boundary, setBoundary] = useState<HeroBoundary | null>(null);
  const [boundaryState, setBoundaryState] =
    useState<BoundaryState>("pending");
  const [imageReady, setImageReady] = useState(false);
  const [view, setView] = useState({ w: 0, h: 0 });

  // Live Vicmap title boundary for the current pin — draws itself in.
  useEffect(() => {
    let alive = true;
    const requestId = ++boundaryRequestRef.current;
    void loadHeroBoundary(pin).then((next) => {
      if (!alive || requestId !== boundaryRequestRef.current) return;
      setBoundary(next);
      setBoundaryState(next ? "live" : "unavailable");
    });
    return () => {
      alive = false;
    };
  }, [pin]);

  // Measure the hero box so the SVG overlay matches the object-fit crop
  // exactly (cover scale + offset math, image-pixel viewBox).
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setView({ w: rect.width, h: rect.height });
    };
    const raf = requestAnimationFrame(update);
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  // Scroll parallax on the image stack + reveal the step cards.
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--hero-scroll", String(window.scrollY));
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    const cards = document.querySelectorAll<HTMLElement>(
      "[data-landing-step=\"true\"]",
    );
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add(css.inview);
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15 },
    );
    cards.forEach((card) => observer.observe(card));
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  /** A picked address re-centres the hero and draws ITS real boundary. */
  function handlePick(item: AddressSuggestion) {
    setChosen(item);
    setAddressLabel(item.place_name);
    const nextPin = { lat: item.lat, lng: item.lng };
    setPin(nextPin);
    setBoundary(null);
    setBoundaryState("pending");
    setAerialUrl(buildHeroAerialUrlFor(nextPin));
    setAerialLowUrl(buildHeroAerialUrlFor(nextPin, 64, 40));
    setImageReady(false);
  }

  function openSite() {
    if (!chosen) return;
    const params = new URLSearchParams({
      address: chosen.place_name,
      lat: String(chosen.lat),
      lng: String(chosen.lng),
    });
    router.push(`/confirm-pin?${params.toString()}`);
  }

  const scale = view.w > 0 ? view.w / HERO_IMAGE_W : 1;
  const dotR = Math.max(2.4, 4.2 / scale);
  const cornerDots: readonly (readonly [number, number])[] =
    boundary === null ? [] : cornerVertices(boundary.polygon);
  const [glowCx, glowCy] =
    boundary === null
      ? [HERO_IMAGE_W / 2, HERO_IMAGE_H / 2]
      : ringCentroidPct(boundary.building ?? boundary.polygon);
  const glowR = boundary?.building ? 0 : 64 / scale;
  const viewBoxStr =
    view.w > 0
      ? `${(HERO_IMAGE_W - view.w / scale) / 2} ${(HERO_IMAGE_H - view.h / scale) / 2} ${view.w / scale} ${view.h / scale}`
      : undefined;
  const titlePoints = boundary === null ? "" : toPoints(boundary.polygon);
  // The hand-written feature legend rides the DEFAULT hero only — picking a
  // real address removes it, so no fabricated features ever sit on a
  // client's actual property.
  const features =
    boundary && view.w > 0 && !chosen
      ? featureLayout(boundary.polygon)
      : null;
  // The pre-sketch (design-intent marks over the survey state) rides the
  // same default-only gate — stamped indicative, anchored to the real ring.
  const preSketch =
    boundary && view.w > 0 && !chosen
      ? buildPreSketch(boundary.polygon, boundary.building)
      : null;

  let statusLabel: string | null;
  if (addressLabel && boundaryState === "live") {
    statusLabel = `live boundary · ${addressLabel}`;
  } else if (addressLabel && boundaryState === "pending") {
    statusLabel = `locating · ${addressLabel}`;
  } else if (addressLabel) {
    statusLabel = `${addressLabel} · boundary unavailable`;
  } else if (boundaryState === "live") {
    statusLabel = `live boundary · ${HERO_ADDRESS}`;
  } else {
    statusLabel = "City of Stonnington · Melbourne";
  }

  return (
    <div className={css.page} data-testid="workstream-landing">
      <section ref={heroRef} className={css.hero}>
        <div className={css.parallax}>
          <div className={css.kenburns}>
            {/* Low-res export paints instantly — the full frame fades over it. */}
            <img
              key={`low-${aerialLowUrl}`}
              className={css.aerialLow}
              src={aerialLowUrl}
              alt=""
              aria-hidden
              data-testid="hero-aerial-base"
            />
            <img
              key={`high-${aerialUrl}`}
              className={`${css.aerialHigh} ${imageReady ? css.aerialReady : ""}`}
              src={aerialUrl}
              alt="Sub-metre aerial of a Victorian residential block"
              fetchPriority="high"
              decoding="async"
              onLoad={() => setImageReady(true)}
              data-testid="hero-aerial"
            />
            {boundary && view.w > 0 ? (
              <svg
                className={css.boundarySvg}
                width={view.w}
                height={view.h}
                viewBox={viewBoxStr}
                preserveAspectRatio="none"
                aria-hidden
                data-testid="hero-boundary"
              >
                {boundary.building ? (
                  <>
                    <path
                      className={css.glowShape}
                      d={`M ${toPoints(boundary.building)} Z`}
                    />
                    <path
                      className={css.glowCore}
                      d={`M ${toPoints(boundary.building)} Z`}
                    />
                  </>
                ) : (
                  <circle
                    className={css.glowShape}
                    cx={glowCx}
                    cy={glowCy}
                    r={glowR}
                  />
                )}
                <path
                  className={css.boundaryPath}
                  d={`M ${titlePoints} Z`}
                  pathLength={1}
                />
                <g className={css.cornerDots}>
                  {cornerDots.map(([x, y], i) => (
                    <circle key={i} cx={x} cy={y} r={dotR} />
                  ))}
                </g>
              </svg>
            ) : null}
            {features ? (
              <svg
                className={css.boundarySvg}
                width={view.w}
                height={view.h}
                viewBox={viewBoxStr}
                preserveAspectRatio="none"
                aria-hidden
                data-testid="hero-features"
              >
                {features.map((f) => (
                  <g key={f.label}>
                    <line
                      className={css.featureTick}
                      x1={f.x - 24}
                      y1={f.y - 6}
                      x2={f.tickTo[0]}
                      y2={f.tickTo[1]}
                    />
                    <text
                      className={css.featureLabel}
                      x={f.x}
                      y={f.y}
                      fontSize={26}
                    >
                      {f.label}
                    </text>
                  </g>
                ))}
              </svg>
            ) : null}
            {preSketch ? (
              <svg
                className={css.boundarySvg}
                width={view.w}
                height={view.h}
                viewBox={viewBoxStr}
                preserveAspectRatio="none"
                aria-hidden
                data-testid="hero-presketch"
              >
                {preSketch.marks.map((m, i) => (
                  <path
                    key={i}
                    className={
                      m.kind === "zone"
                        ? css.sketchZone
                        : m.kind === "canopy"
                          ? css.sketchCanopy
                          : css.sketchDeck
                    }
                    d={m.d}
                  />
                ))}
                {preSketch.path ? (
                  <path className={css.sketchPath} d={preSketch.path} />
                ) : null}
                {preSketch.hatches.map((d, i) => (
                  <path key={`h-${i}`} className={css.sketchHatch} d={d} />
                ))}
                {preSketch.labels.map((l) => (
                  <text
                    key={l.text}
                    className={css.sketchLabel}
                    x={l.x}
                    y={l.y}
                    fontSize={26}
                  >
                    {l.text}
                  </text>
                ))}
              </svg>
            ) : null}
          </div>
        </div>
        <div className={css.scrim} aria-hidden />
        <div className={css.vignette} aria-hidden />

        {/* Locational-indicative stamp — the pre-sketch is design intent,
            never survey truth. */}
        {preSketch ? (
          <div className={css.sketchStamp} data-testid="hero-presketch-stamp">
            pre-sketch · indicative
          </div>
        ) : null}

        <header className={css.topbar}>
          <div className={css.brand}>
            <span className={css.brandMark} aria-hidden />
            <span className={css.brandText}>Workstream</span>
          </div>
          <span className={css.coordChip}>VIC · {pinDmsLabel(pin)}</span>
          <nav className={css.topbarLinks} aria-label="Landing">
            <Link href="/home" className={css.topbarLink}>
              Open the studio
            </Link>
            <Link href="/settings" className={css.topbarLink}>
              Settings
            </Link>
          </nav>
        </header>

        {/* The pitch — the studio's positioning over the real frame. */}
        <div className={css.heroCopy}>
          <h1 className={css.heroTitle}>
            From GIS Ingest to Client Sign-Off.
          </h1>
          <p className={css.heroSkip}>Skip the CAD.</p>
          <p className={css.heroLed}>
            Drop an address. Auto-stream Vicmap boundaries, SPI, overlays,
            and contours directly into an infinite 3D canvas. Sketch with
            true stylus telemetry, run live parametric takeoffs, and send
            clients a frosted-glass portal for instant deposit and approval.
          </p>
          <Link
            href="/home"
            className={css.heroCta}
            data-testid="hero-open-studio"
          >
            Open the Studio
          </Link>
        </div>

        <HeroAddressEntry
          onPick={handlePick}
          onOpen={openSite}
          statusLabel={statusLabel}
        />
      </section>

      <section className={css.steps} aria-labelledby="steps-heading">
        <header className={css.stepsHead}>
          <h2 id="steps-heading" className={css.stepsHeading}>
            The Studio Workflow
          </h2>
        </header>
        <div className={css.stepsGrid}>
          {WORKFLOW.map((step) => (
            <article
              className={css.stepCard}
              data-landing-step="true"
              key={step.num}
            >
              <p className={css.stepNum}>{step.num}</p>
              <h3 className={css.stepTitle}>{step.title}</h3>
              <p className={css.stepBody}>{step.body}</p>
            </article>
          ))}
        </div>
        <ul className={css.chips} aria-label="What this page runs on">
          <li className={css.chip}>Vicmap cadastre — keyless state data</li>
          <li className={css.chip}>Sub-metre Esri aerial</li>
          {boundaryState === "live" ? (
            <li className={css.chip}>Hero boundary — live registry polygon</li>
          ) : null}
        </ul>
      </section>

      <footer className={css.footer}>
        <div className={css.footerInner}>
          <p className={css.footerBrand}>
            Workstream — site truth, sketch, CAD and quote for landscape
            builders.
          </p>
          <nav className={css.footerLinks} aria-label="Apps">
            <Link href="/home" className={css.footerLink}>
              Desktop app — open the studio
            </Link>
            <span className={css.footerNote}>
              Mobile field app — EAS build, store release pending
            </span>
            <Link href="/settings" className={css.footerLink}>
              Settings
            </Link>
            <Link href="/legal/privacy" className={css.footerLink}>
              Privacy
            </Link>
            <Link href="/legal/terms" className={css.footerLink}>
              Terms
            </Link>
          </nav>
          <p className={css.footerNote}>Melbourne, Victoria · en-AU</p>
        </div>
      </footer>
    </div>
  );
}
