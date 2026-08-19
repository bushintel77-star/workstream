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

const STEPS = [
  {
    num: "01",
    title: "Title",
    body: "One boundary, pulled from the live Victorian cadastre. Not eyeballed, not fabricated.",
  },
  {
    num: "02",
    title: "Sketch onsite",
    body: "Freehand over the sub-metre aerial, or photo-trace the frontage against a calibrated 1.8 m fence line.",
  },
  {
    num: "03",
    title: "Fit sheet",
    body: "Generate the quote fit sheet from the same polygon that started everything.",
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

/**
 * The landing says nothing — the entry IS the pitch. A real Stonnington
 * aerial, one lit property, a live Vicmap title boundary. Type an address
 * and the hero re-centres on YOUR property and draws ITS boundary; then one
 * tap enters the product. The product demonstrates itself.
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
          </div>
        </div>
        <div className={css.scrim} aria-hidden />
        <div className={css.vignette} aria-hidden />

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

        <HeroAddressEntry
          onPick={handlePick}
          onOpen={openSite}
          statusLabel={statusLabel}
        />
      </section>

      <section className={css.steps} aria-labelledby="steps-heading">
        <header className={css.stepsHead}>
          <p className={css.stepsKicker}>The single source of truth</p>
          <h2 id="steps-heading" className={css.stepsHeading}>
            One polygon, three moves.
          </h2>
        </header>
        <div className={css.stepsGrid}>
          {STEPS.map((step) => (
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
