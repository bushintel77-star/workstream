"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  buildHeroAerialUrlFor,
  HERO_ADDRESS,
  HERO_PIN,
  loadHeroBoundary,
  pinDmsLabel,
  type GeoPin,
  type HeroBoundary,
} from "../../lib/landingGeo";
import {
  HeroAddressEntry,
  type AddressSuggestion,
} from "./HeroAddressEntry";
import { HeroSiteAnalysisOverlay } from "./HeroSiteAnalysisOverlay";
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
  const [boundaryState, setBoundaryState] = useState<BoundaryState>("pending");
  const [imageReady, setImageReady] = useState(false);

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

  const siteLocationLabel = addressLabel ?? HERO_ADDRESS;
  let statusLabel: string;
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
          </div>
          <HeroSiteAnalysisOverlay
            boundary={boundary}
            aerialUrl={aerialUrl}
            locationLabel={siteLocationLabel}
          />
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
            <Link href="/sign-in" className={css.topbarLink}>
              Sign in
            </Link>
            <Link href="/settings" className={css.topbarLink}>
              Settings
            </Link>
          </nav>
        </header>

        <div className={css.heroCopy}>
          <h1 className={css.heroTitle}>From GIS Ingest to Client Sign-Off.</h1>
          <p className={css.heroSkip}>Skip the CAD.</p>
          <p className={css.heroLed}>
            Drop an address. Auto-stream Vicmap boundaries, SPI, overlays,
            and contours directly into an infinite 3D canvas. Sketch with
            true stylus telemetry, run live parametric takeoffs, and send
            clients a frosted-glass portal for instant deposit and approval.
          </p>
          <div className={css.heroCtaRow}>
            <Link href="/home" className={css.heroCta} data-testid="hero-open-studio">
              Open the Studio
            </Link>
            <Link href="/sign-in" className={css.heroSignIn} data-testid="hero-sign-in">
              Sign in
            </Link>
          </div>
        </div>

        <HeroAddressEntry onPick={handlePick} onOpen={openSite} statusLabel={statusLabel} />
      </section>

      <section className={css.steps} aria-labelledby="steps-heading">
        <header className={css.stepsHead}>
          <h2 id="steps-heading" className={css.stepsHeading}>The Studio Workflow</h2>
        </header>
        <div className={css.stepsGrid}>
          {WORKFLOW.map((step) => (
            <article className={css.stepCard} data-landing-step="true" key={step.num}>
              <p className={css.stepNum}>{step.num}</p>
              <h3 className={css.stepTitle}>{step.title}</h3>
              <p className={css.stepBody}>{step.body}</p>
            </article>
          ))}
        </div>
        <ul className={css.chips} aria-label="What this page runs on">
          <li className={css.chip}>Vicmap cadastre — keyless state data</li>
          <li className={css.chip}>Sub-metre Esri aerial</li>
          {boundaryState === "live" ? <li className={css.chip}>Hero boundary — live registry polygon</li> : null}
        </ul>
      </section>

      <footer className={css.footer}>
        <div className={css.footerInner}>
          <p className={css.footerBrand}>Workstream — site truth, sketch, CAD and quote for landscape builders.</p>
          <nav className={css.footerLinks} aria-label="Apps">
            <Link href="/home" className={css.footerLink}>Desktop app — open the studio</Link>
            <Link href="/sign-in" className={css.footerLink}>Sign in</Link>
            <span className={css.footerNote}>Mobile field app — EAS build, store release pending</span>
            <Link href="/settings" className={css.footerLink}>Settings</Link>
            <Link href="/legal/privacy" className={css.footerLink}>Privacy</Link>
            <Link href="/legal/terms" className={css.footerLink}>Terms</Link>
          </nav>
          <p className={css.footerNote}>Melbourne, Victoria · en-AU</p>
        </div>
      </footer>
    </div>
  );
}
