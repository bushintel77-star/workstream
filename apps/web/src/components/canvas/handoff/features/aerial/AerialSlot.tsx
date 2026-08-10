"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TactileGround } from "../ground/TactileGround";
import type { SheetScaleDenom } from "../ground/groundMetrics";
import { CameraChrome } from "../../CameraChrome";
import css from "./aerialSlot.module.css";

export type CanopyImagePayload = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

type Props = {
  uri: string | null;
  dimmed: boolean;
  frameOn: boolean;
  scanning: boolean;
  zoom?: number;
  /**
   * Live metres across 100% of the board (free plan). When provided, the
   * ground mesh + chip read this scale instead of the print-plot denom.
   * Fit sheet omits this and passes `sheetScaleDenom`.
   */
  scaleM?: number;
  sheetScaleDenom?: SheetScaleDenom;
  darkOn?: boolean;
  /** Stage 1 — Vicmap title ground phase (not a stand-in for CAD/Sketch). */
  foundationCleanse?: boolean;
  /**
   * When false, AerialSlot never paints imagery or the drop cue.
   * CAD/Sketch drafting plates pass false; Survey may pass true.
   */
  allowAerial?: boolean;
  /**
   * Allow SVG/PNG survey-plan underlay on drafting plates (no satellite required).
   * Distinct from allowAerial — plan underlay keeps parchment dominant.
   */
  allowPlanUnderlay?: boolean;
  /**
   * Opt-in aerial colour canopy clustering. Default off — silent auto-scan
   * was flooding Cad with AI proposals on every aerial load.
   */
  autoCanopyScan?: boolean;
  /**
   * One-shot canopy scan request — when this nonce changes, run the scan
   * once against the loaded aerial. Lets the operator trigger canopy
   * detection manually (Cmd+K "Scan canopy from aerial") without auto-firing
   * on every aerial load.
   */
  canopyScanRequest?: number;
  /** Vicmap / Stage 1 title cue (not "ghost cadastral"). */
  titleLocked?: boolean;
  boundarySource?: "vicmap" | "manual" | "seed";
  siteLabel?: string | null;
  address?: string | null;
  /** CadPlan owns street cue in title mode — suppress ground duplicate. */
  suppressSiteCue?: boolean;
  /** 0–1 parchment tooth when aerial is stacked (soft underlay). */
  parchmentPeel?: number;
  /**
   * Hide world parchment/mesh when free-plan paper is owned by the fixed
   * bleed underlay — also clears this slot's cream `#faf6f2` fill so the
   * sheet cannot ride `.zoomWorld` scale (postage-stamp board).
   */
  hidePaper?: boolean;
  /**
   * Drawing-plane law: unmount onboarding drop cue when any vectors / assets
   * exist or a drafting tool is armed — never collide with live CAD text.
   */
  hasGeometry?: boolean;
  canvasEngaged?: boolean;
  onUri: (uri: string | null) => void;
  onScanning: (v: boolean) => void;
  onCanopyImage: (image: CanopyImagePayload) => void | Promise<void>;
};

/**
 * Site plane: tactile parchment ground always present; aerial cross-fades above
 * as a soft underlay stack — never a sterile void / checkerboard.
 */
export function AerialSlot({
  uri,
  dimmed,
  frameOn,
  scanning,
  zoom = 1,
  scaleM,
  sheetScaleDenom = 100,
  darkOn = false,
  foundationCleanse = false,
  allowAerial = true,
  allowPlanUnderlay = false,
  autoCanopyScan = false,
  canopyScanRequest = 0,
  titleLocked = false,
  boundarySource = "seed",
  siteLabel = null,
  address = null,
  suppressSiteCue = false,
  parchmentPeel = 0.42,
  hidePaper = false,
  hasGeometry = false,
  canvasEngaged = false,
  onUri,
  onScanning,
  onCanopyImage,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [aerialReady, setAerialReady] = useState(false);
  const [aerialError, setAerialError] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const scannedFor = useRef<string | null>(null);

  useEffect(() => {
    setAerialReady(false);
    setAerialError(false);
    setRetryNonce(0);
  }, [uri]);

  const runCanopyScan = useCallback(
    async (src: string) => {
      if (scannedFor.current === src) return;
      scannedFor.current = src;
      onScanning(true);
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("aerial load failed"));
          img.src = src;
        });
        const size = 96;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size);
        onCanopyImage({
          width: size,
          height: size,
          data: data.data,
        });
      } catch {
        /* heuristic best-effort */
      } finally {
        onScanning(false);
      }
    },
    [onCanopyImage, onScanning],
  );

  const aerialEnabled = allowAerial && !foundationCleanse;
  const underlayEnabled =
    !foundationCleanse && (aerialEnabled || allowPlanUnderlay);

  useEffect(() => {
    if (!aerialEnabled || !autoCanopyScan || !uri || frameOn) return;
    void runCanopyScan(uri);
  }, [uri, frameOn, aerialEnabled, autoCanopyScan, runCanopyScan]);

  // One-shot manual canopy scan — triggered when canopyScanRequest changes.
  const lastScanReq = useRef(0);
  useEffect(() => {
    if (canopyScanRequest === lastScanReq.current) return;
    lastScanReq.current = canopyScanRequest;
    if (!aerialEnabled || !uri || frameOn) return;
    void runCanopyScan(uri);
  }, [canopyScanRequest, aerialEnabled, uri, frameOn, runCanopyScan]);

  const acceptFile = (file: File | null) => {
    if (!underlayEnabled) return;
    if (!file) return;
    const okType =
      file.type.startsWith("image/") ||
      file.type === "image/svg+xml" ||
      /\.svg$/i.test(file.name);
    if (!okType) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      if (result) {
        scannedFor.current = null;
        onUri(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const showAerial = Boolean(uri) && !frameOn && underlayEnabled;
  const planOnly = allowPlanUnderlay && !aerialEnabled;
  /**
   * Barren idle lot only. Vicmap / title-locked sites, any vectors, armed tools,
   * or an underlay URI all force a full unmount — never collide with CAD labels.
   */
  const showDropCue =
    !uri &&
    underlayEnabled &&
    !hasGeometry &&
    !canvasEngaged &&
    !titleLocked &&
    !suppressSiteCue &&
    !frameOn &&
    !foundationCleanse;

  return (
    <div
      className={css.slot}
      data-testid="aerial-image-slot"
      data-filled={showAerial ? "true" : "false"}
      data-ground="tactile-parchment"
      data-hide-paper={hidePaper ? "1" : "0"}
      data-foundation={foundationCleanse ? "true" : "false"}
      data-allow-aerial={aerialEnabled ? "true" : "false"}
      data-allow-plan={allowPlanUnderlay ? "true" : "false"}
      onDragOver={(e) => {
        if (!underlayEnabled) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (!underlayEnabled) return;
        acceptFile(e.dataTransfer.files?.[0] ?? null);
      }}
      onClick={() => {
        if (!underlayEnabled || uri) return;
        inputRef.current?.click();
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.svg,image/svg+xml"
        className={css.file}
        disabled={!underlayEnabled}
        onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
      />

      <TactileGround
        zoom={zoom}
        scaleM={scaleM}
        sheetScaleDenom={sheetScaleDenom}
        parchmentPeel={
          foundationCleanse || !underlayEnabled
            ? 1
            : planOnly
              ? Math.max(parchmentPeel, 0.72)
              : parchmentPeel
        }
        hasAerial={showAerial && aerialReady}
        darkOn={darkOn}
        foundationCleanse={foundationCleanse}
        titleLocked={titleLocked}
        boundarySource={boundarySource}
        siteLabel={siteLabel}
        address={address ?? siteLabel}
        suppressSiteCue={suppressSiteCue}
        quietChrome
        hidePaper={hidePaper}
      />

      {showAerial && uri ? (
        <img
          key={retryNonce}
          ref={imgRef}
          src={uri}
          alt=""
          aria-hidden="true"
          className={`${css.img}${aerialReady ? ` ${css.imgReady}` : ""}`}
          style={{
            opacity: frameOn
              ? 0
              : !aerialReady
                ? 0
                : dimmed
                  ? 0.55
                  : planOnly
                    ? Math.max(0.35, 0.65 - parchmentPeel * 0.2)
                    : Math.max(0.55, 1 - parchmentPeel * 0.35),
          }}
          draggable={false}
          onLoad={() => {
            setAerialError(false);
            setAerialReady(true);
          }}
          onError={() => {
            setAerialReady(false);
            setAerialError(true);
          }}
        />
      ) : null}

      {showAerial && aerialError ? (
        <CameraChrome>
          <div className={css.errorPanel} role="alert">
            <p className={css.primaryText}>Aerial image failed to load</p>
            <p className={css.metaText}>
              Check the source or retry the survey underlay
            </p>
            <button
              type="button"
              className={css.retryButton}
              onClick={(event) => {
                event.stopPropagation();
                setAerialError(false);
                setRetryNonce((value) => value + 1);
              }}
            >
              Retry image
            </button>
          </div>
        </CameraChrome>
      ) : null}

      {showDropCue ? (
        <CameraChrome>
          <div
            className={`${css.dropCue}${dragOver ? ` ${css.dropCueHot}` : ""}`}
            data-testid="aerial-drop-cue"
            aria-hidden
          >
            <p className={css.primaryText}>
              {planOnly
                ? "Drop a survey plan (SVG/PNG) — no aerial required"
                : "Drop a top-down aerial or survey plan"}
            </p>
            <p className={css.metaText}>Stays as the drafting background</p>
          </div>
        </CameraChrome>
      ) : null}

      {scanning && aerialEnabled ? (
        <CameraChrome>
          <div className={css.scanPill} data-testid="canopy-scanning">
            <span className={css.scanDot} />
            AI scanning aerial for canopy…
          </div>
        </CameraChrome>
      ) : null}
    </div>
  );
}
