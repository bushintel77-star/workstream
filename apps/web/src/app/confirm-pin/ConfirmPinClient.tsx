"use client";

/**
 * First-create locate loader only — not shown when reopening a project.
 * Canvas-first: full-bleed aerial plane + frost chrome (same law as the studio).
 * Neighbourhood → lot zoom, Vicmap boundary, then into the design canvas.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createProjectWithSurveyAction,
  geocodePreviewAction,
} from "../actions";
import {
  parseMapboxStaticAerial,
  projectLngLatToPercent,
} from "../../lib/mapView";
import cp from "./confirm-pin.module.css";
import { useToast } from "../../components/ToastHost";

type Props = {
  address: string;
  lat: number;
  lng: number;
};

const ZOOM_MS = 1500;
const SETTLE_MS = 1200;

/** Loader narrative — the studio doing the council/state paperwork the operator
 *  would otherwise chase by hand. Every line maps to a real Vicmap/keyless pull. */
const CAPABILITY_PHRASES = [
  "Linking to Vicmap · Land Use Victoria…",
  "Requesting the site plan of survey…",
  "Measuring the title boundary…",
  "Talking to council…",
  "Scanning for heritage overlays…",
  "Tracing easements and underground services…",
  "Mapping sun and overshadowing…",
];

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function ringToSvgPoints(
  ring: [number, number][],
  aerialUri: string,
): string | null {
  const view = parseMapboxStaticAerial(aerialUri);
  if (!view) return null;
  const closed =
    ring.length >= 2 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1];
  const pts = closed ? ring.slice(0, -1) : ring;
  if (pts.length < 3) return null;
  return pts
    .map(([ringLng, ringLat]) => {
      const [x, y] = projectLngLatToPercent(ringLng, ringLat, view);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export function ConfirmPinClient({ address, lat, lng }: Props) {
  const router = useRouter();
  const toast = useToast();
  const started = useRef(false);
  const [measuring, setMeasuring] = useState(false);
  const [zoomIn, setZoomIn] = useState(false);
  const [showLot, setShowLot] = useState(false);
  const [showBoundary, setShowBoundary] = useState(false);
  const [neighbourhoodUri, setNeighbourhoodUri] = useState<string | null>(null);
  const [lotUri, setLotUri] = useState<string | null>(null);
  const [titleRing, setTitleRing] = useState<[number, number][] | null>(null);
  const [lotAreaM2, setLotAreaM2] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const boundaryPoints = useMemo(() => {
    if (!titleRing || !lotUri) return null;
    return ringToSvgPoints(titleRing, lotUri);
  }, [titleRing, lotUri]);

  /** Full-frame rect with the lot punched out (even-odd) — dims every other
   *  property so the targeted lot reads as selected. */
  const surroundPath = useMemo(() => {
    if (!boundaryPoints) return null;
    const inner = boundaryPoints.trim().split(/\s+/);
    if (inner.length < 3) return null;
    const innerPath = `M${inner[0]} L${inner.slice(1).join(" L")} Z`;
    return `M0,0 L100,0 L100,100 L0,100 Z ${innerPath}`;
  }, [boundaryPoints]);

  useEffect(() => {
    // One run per address pin. Do not gate with a sticky `started` ref + cancel
    // on dep churn — toast/router identity used to abort after create succeeded
    // and leave the map frozen forever.
    if (started.current) return;
    started.current = true;

    let alive = true;

    void (async () => {
      try {
        const createPromise = (async () => {
          const fd = new FormData();
          fd.set("address", address);
          fd.set("lat", String(lat));
          fd.set("lng", String(lng));
          return createProjectWithSurveyAction(fd);
        })();

        const preview = await geocodePreviewAction(lat, lng).catch(() => null);
        if (alive && preview) {
          setNeighbourhoodUri(preview.neighbourhood_uri);
          setLotUri(preview.aerial_uri);
        }

        await sleep(120);
        if (alive) setZoomIn(true);

        await sleep(Math.round(ZOOM_MS * 0.62));
        if (alive) {
          setShowLot(true);
          setMeasuring(true);
        }

        const [, created] = await Promise.all([
          sleep(Math.round(ZOOM_MS * 0.38)),
          createPromise,
        ]);

        if (alive) {
          if (created.aerialUri) setLotUri(created.aerialUri);
          if (created.titleRing) {
            setTitleRing(created.titleRing);
            requestAnimationFrame(() => {
              if (alive) setShowBoundary(true);
            });
          }
          if (created.lotAreaM2 != null) setLotAreaM2(created.lotAreaM2);
        }

        await sleep(SETTLE_MS);

        // Always enter the canvas once the project exists — never strand the
        // loader because a parent remount cancelled the effect mid-flight.
        router.replace(`/projects/${created.projectId}?guide=1`);
        router.refresh();
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Could not create project";
        if (alive) setError(msg);
        toast.show(msg, "error", 6000);
        started.current = false;
      }
    })();

    return () => {
      alive = false;
    };
  }, [address, lat, lng, router, toast]);

  const [capIdx, setCapIdx] = useState(0);
  useEffect(() => {
    if (!measuring || error) return;
    const id = window.setInterval(() => {
      setCapIdx((i) => Math.min(i + 1, CAPABILITY_PHRASES.length - 1));
    }, 650);
    return () => window.clearInterval(id);
  }, [measuring, error]);

  const status = error
    ? "Could not open site"
    : measuring
      ? CAPABILITY_PHRASES[capIdx]
      : zoomIn
        ? "Zooming to the lot…"
        : "Locating your property…";

  return (
    <div
      className={cp.stage}
      data-testid="locate-loader-stage"
      aria-busy={!error}
      aria-live="polite"
    >
      <div className={cp.bleed} aria-hidden />

      <div className={cp.zoomWorld} data-testid="locate-loader-aerial">
        {neighbourhoodUri ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={neighbourhoodUri}
            alt=""
            className={`${cp.aerial} ${cp.aerialNeighbourhood}${zoomIn ? ` ${cp.aerialZoomIn}` : ""}${showLot ? ` ${cp.aerialFaded}` : ""}`}
          />
        ) : null}

        {lotUri ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lotUri}
            alt=""
            className={`${cp.aerial} ${cp.aerialLot}${showLot ? ` ${cp.aerialLotVisible}` : ""}`}
          />
        ) : null}

        {surroundPath ? (
          <svg
            className={`${cp.surroundScrim}${showBoundary ? ` ${cp.surroundVisible}` : ""}`}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path className={cp.surroundFill} d={surroundPath} fillRule="evenodd" />
          </svg>
        ) : null}

        {boundaryPoints ? (
          <svg
            className={`${cp.boundaryOverlay}${showBoundary ? ` ${cp.boundaryVisible}` : ""}`}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            <polygon className={cp.boundaryFill} points={boundaryPoints} />
            <polygon className={cp.boundaryStroke} points={boundaryPoints} />
          </svg>
        ) : null}
      </div>

      <header className={cp.chrome} data-camera-chrome>
        <div className={cp.chromeBrand}>
          <span className={cp.brandMark}>Curtis &amp; Co</span>
          <span className={cp.status}>{status}</span>
        </div>
        <p className={cp.address}>{address}</p>
        {lotAreaM2 != null && lotAreaM2 > 0 ? (
          <p className={cp.meta}>
            {Math.round(lotAreaM2).toLocaleString("en-AU")} m²
          </p>
        ) : null}
      </header>

      {error ? (
        <div className={cp.errorPlate}>
          <p className={cp.error}>{error}</p>
          <Link href="/" className={cp.errorLink}>
            Back to projects
          </Link>
        </div>
      ) : null}
    </div>
  );
}
