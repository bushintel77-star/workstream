"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DesignCanvas } from "@workstream/contracts";
import {
  arAlignLabel,
  arRingPointsAttr,
  buildArBirdseyeScene,
  polygonIou,
  type ArPctPoint,
} from "@workstream/domain";
import css from "./arBirdseye.module.css";

export type ArBirdseyeOverlayProps = {
  canvas?: DesignCanvas | null;
  /** Optional studio boundary/building when canvas.site_frame is thin. */
  boundary?: Array<{ x_pct: number; y_pct: number }>;
  building?: Array<{ x_pct: number; y_pct: number }>;
  placements?: Array<{
    id: string;
    x_pct: number;
    y_pct: number;
    symbol_id?: string | null;
  }>;
  address?: string;
  onClose: () => void;
  /** When true, skip getUserMedia and use the static paper fallback (tests / denied). */
  forceFallback?: boolean;
};

/**
 * On-site bird's-eye AR — rear camera + plan overlay with footprint occlusion.
 * Calibrate with pan / rotate / scale. IoU score is indicative only.
 */
export function ArBirdseyeOverlay({
  canvas = null,
  boundary,
  building,
  placements,
  address,
  onClose,
  forceFallback = false,
}: ArBirdseyeOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [occlusionOn, setOcclusionOn] = useState(true);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [scale, setScale] = useState(1);
  const [rot, setRot] = useState(0);
  const dragRef = useRef<{
    x: number;
    y: number;
    tx: number;
    ty: number;
  } | null>(null);

  const scene = useMemo(
    () =>
      buildArBirdseyeScene({
        boundary: boundary?.length
          ? boundary
          : canvas?.site_frame?.boundary,
        building: building?.length
          ? building
          : canvas?.site_frame?.building,
        placements: placements?.length
          ? placements
          : canvas?.placements ?? [],
      }),
    [canvas, boundary, building, placements],
  );

  /** Reference ring for IoU — identity boundary in overlay space. */
  const alignIou = useMemo(() => {
    if (scene.boundary.length < 3) return 0;
    // Score how much building sits inside boundary after a trivial nudge —
    // when both exist, IoU(building, building) = 1; we instead score
    // calibration drift vs identity by comparing boundary to a rotated copy.
    const rad = (rot * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const drifted: ArPctPoint[] = scene.boundary.map((p) => {
      const cx = p.x - 50;
      const cy = p.y - 50;
      return {
        x: 50 + (cx * cos - cy * sin) * scale + tx * 0.15,
        y: 50 + (cx * sin + cy * cos) * scale + ty * 0.15,
      };
    });
    return polygonIou(scene.boundary, drifted);
  }, [scene.boundary, rot, scale, tx, ty]);

  const alignBand = arAlignLabel(alignIou);

  useEffect(() => {
    if (forceFallback) {
      setCameraError("Camera preview unavailable — plan overlay only.");
      return;
    }
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera API not available in this browser.");
        }
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        setCameraError(null);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Camera permission denied.";
        setCameraError(msg);
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [forceFallback]);

  const buildingPts = arRingPointsAttr(scene.building);
  const boundaryPts = arRingPointsAttr(scene.boundary);
  const maskId = "ar-footprint-mask";

  return (
    <div className={css.root} data-testid="ar-birdseye-overlay">
      <div className={css.stage}>
        {cameraError ? (
          <div className={css.fallback} data-testid="ar-birdseye-fallback">
            <p>{cameraError}</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            className={css.video}
            playsInline
            muted
            autoPlay
            data-testid="ar-birdseye-video"
          />
        )}

        <div
          className={css.overlayHost}
          style={{
            transform: `translate(${tx}px, ${ty}px) rotate(${rot}deg) scale(${scale})`,
          }}
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            dragRef.current = { x: e.clientX, y: e.clientY, tx, ty };
          }}
          onPointerMove={(e) => {
            const d = dragRef.current;
            if (!d) return;
            setTx(d.tx + (e.clientX - d.x));
            setTy(d.ty + (e.clientY - d.y));
          }}
          onPointerUp={() => {
            dragRef.current = null;
          }}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
          data-testid="ar-birdseye-calibrate"
        >
          <svg
            className={css.plan}
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden
          >
            <defs>
              {occlusionOn && scene.building.length >= 3 ? (
                <mask id={maskId}>
                  <rect x="0" y="0" width="100" height="100" fill="white" />
                  <polygon points={buildingPts} fill="black" />
                </mask>
              ) : null}
            </defs>

            {scene.boundary.length >= 3 ? (
              <polygon
                points={boundaryPts}
                className={css.boundary}
              />
            ) : null}

            <g
              mask={
                occlusionOn && scene.building.length >= 3
                  ? `url(#${maskId})`
                  : undefined
              }
              data-testid="ar-birdseye-proposed"
            >
              {scene.placements.map((p) => (
                <circle
                  key={p.id}
                  cx={p.x}
                  cy={p.y}
                  r={p.r}
                  className={
                    p.kind === "planting"
                      ? css.plant
                      : p.kind === "hardscape"
                        ? css.hard
                        : css.other
                  }
                  data-kind={p.kind}
                />
              ))}
            </g>

            {scene.building.length >= 3 ? (
              <polygon
                points={buildingPts}
                className={css.building}
                data-testid="ar-birdseye-building"
              />
            ) : null}
          </svg>
        </div>
      </div>

      <aside className={css.dock} data-testid="ar-birdseye-dock">
        <div className={css.headRow}>
          <p className={css.kicker}>AR bird&apos;s-eye</p>
          <button
            type="button"
            className={css.close}
            aria-label="Close AR overlay"
            data-testid="ar-birdseye-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {address ? <p className={css.address}>{address}</p> : null}
        <p className={css.honesty}>{scene.honesty}</p>
        <p
          className={css.align}
          data-testid="ar-birdseye-align"
          data-band={alignBand}
        >
          Align {alignBand}
          <span className={css.muted}>
            {" "}
            · IoU {alignIou.toFixed(2)} (indicative)
          </span>
        </p>
        <div className={css.controls}>
          <label className={css.slider}>
            Rotate
            <input
              type="range"
              min={-45}
              max={45}
              step={1}
              value={rot}
              onChange={(e) => setRot(Number(e.target.value))}
              data-testid="ar-birdseye-rotate"
            />
          </label>
          <label className={css.slider}>
            Scale
            <input
              type="range"
              min={0.6}
              max={1.6}
              step={0.02}
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              data-testid="ar-birdseye-scale"
            />
          </label>
          <button
            type="button"
            className={css.toggle}
            data-testid="ar-birdseye-occlusion"
            data-on={occlusionOn ? "1" : "0"}
            onClick={() => setOcclusionOn((v) => !v)}
          >
            {occlusionOn ? "Occlusion on" : "Occlusion off"}
          </button>
          <button
            type="button"
            className={css.toggle}
            data-testid="ar-birdseye-reset"
            onClick={() => {
              setTx(0);
              setTy(0);
              setScale(1);
              setRot(0);
            }}
          >
            Reset align
          </button>
        </div>
        <p className={css.tip}>
          Drag the plan to pan. Building footprint masks proposed planting so it
          reads behind the dwelling.
        </p>
      </aside>
    </div>
  );
}
