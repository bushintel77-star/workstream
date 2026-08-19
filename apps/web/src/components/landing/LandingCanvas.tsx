"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  HERO_ADDRESS,
  HERO_IMAGE_H,
  HERO_IMAGE_W,
  loadHeroBoundary,
  ringCentroidPct,
  type HeroBoundary,
} from "../../lib/landingGeo";
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

export function LandingCanvas({
  aerialUrl,
  aerialLowUrl,
  pinLabel,
}: {
  aerialUrl: string;
  aerialLowUrl: string;
  pinLabel: string;
}) {
  const heroRef = useRef<HTMLElement | null>(null);
  const [boundary, setBoundary] = useState<HeroBoundary | null>(null);
  const [boundaryState, setBoundaryState] =
    useState<BoundaryState>("pending");
  const [imageReady, setImageReady] = useState(false);
  const [view, setView] = useState({ w: 0, h: 0 });

  // Live Vicmap title boundary — draws itself in when the feed lands.
  useEffect(() => {
    let alive = true;
    void loadHeroBoundary().then((next) => {
      if (!alive) return;
      setBoundary(next);
      setBoundaryState(next ? "live" : "unavailable");
    });
    return () => {
      alive = false;
    };
  }, []);

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

  const scale = view.w > 0 ? view.w / HERO_IMAGE_W : 1;
  const dotR = Math.max(2.4, 4.2 / scale);
  const cornerDots: readonly (readonly [number, number])[] =
    boundary === null ? [] : cornerVertices(boundary.polygon);
  const [glowCx, glowCy] =
    boundary === null
      ? [HERO_IMAGE_W / 2, HERO_IMAGE_H / 2]
      : ringCentroidPct(boundary.building ?? boundary.polygon);
  const glowR = boundary?.building ? 0 : 64 / scale;

  return (
    <div className={css.page} data-testid="workstream-landing">
      <section ref={heroRef} className={css.hero}>
        <div className={css.parallax}>
          <div className={css.kenburns}>
            {/* Low-res export paints instantly — the full frame fades over it. */}
            <img
              className={css.aerialLow}
              src={aerialLowUrl}
              alt=""
              aria-hidden
              data-testid="hero-aerial-base"
            />
            <img
              className={`${css.aerialHigh} ${imageReady ? css.aerialReady : ""}`}
              src={aerialUrl}
              alt="Sub-metre aerial of a Stonnington residential block"
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
                viewBox={`${(HERO_IMAGE_W - view.w / scale) / 2} ${(HERO_IMAGE_H - view.h / scale) / 2} ${view.w / scale} ${view.h / scale}`}
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
                  d={`M ${toPoints(boundary.polygon)} Z`}
                  pathLength={1}
                />
                <g className={css.cornerDots}>
                  {cornerDots.map(([x, y], i) => (
                    <circle key={i} cx={x} cy={y} r={dotR} />
                  ))}
                </g>
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
          <span className={css.coordChip}>
            Stonnington · {pinLabel}
          </span>
          <nav className={css.topbarLinks} aria-label="Landing">
            <Link href="/home" className={css.topbarLink}>
              Open the studio
            </Link>
            <Link href="/settings" className={css.topbarLink}>
              Settings
            </Link>
          </nav>
        </header>

        <div className={css.copyLayer}>
          <p className={css.kicker} data-testid="hero-boundary-status">
            {boundaryState === "live"
              ? `${HERO_ADDRESS} · live registry boundary`
              : "City of Stonnington · Melbourne"}
          </p>
          <h1 className={css.headline}>Onsite sketch to fit sheet.</h1>
          <p className={css.body}>
            One title boundary, pulled from the live Victorian cadastre —
            not drawn from memory, not eyeballed, not fabricated. Every line
            you sketch, every elevation you trace, every plant you place sits
            on the one polygon that actually defines the site.
          </p>
          <p className={css.flowline}>
            Start with a title. Sketch onsite. Trace the street frontage from
            a photo calibrated against a 1.8 m fence line. Generate the fit
            sheet — all from the same boundary polygon, the single source of
            truth for everything that follows.
          </p>
          <div className={css.ctaRow}>
            <Link href="/home#new-project" className={css.ctaPrimary}>
              Enter your address
            </Link>
            <Link href="/home" className={css.ctaGhost}>
              Open the studio
            </Link>
          </div>
        </div>
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
        <div className={css.ctaRow}>
          <Link href="/home#new-project" className={css.ctaPrimary}>
            Enter your address
          </Link>
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
