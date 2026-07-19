"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PctPoint } from "../../geometry";
import { TactileGround } from "../ground/TactileGround";
import type { SheetScaleDenom } from "../ground/groundMetrics";
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
  sheetScaleDenom?: SheetScaleDenom;
  darkOn?: boolean;
  boundary?: PctPoint[];
  building?: PctPoint[];
  siteLabel?: string | null;
  address?: string | null;
  /** 0–1 parchment tooth when aerial is stacked (soft underlay). */
  parchmentPeel?: number;
  onUri: (uri: string | null) => void;
  onScanning: (v: boolean) => void;
  onCanopyImage: (image: CanopyImagePayload) => void;
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
  sheetScaleDenom = 100,
  darkOn = false,
  boundary = [],
  building = [],
  siteLabel = null,
  address = null,
  parchmentPeel = 0.42,
  onUri,
  onScanning,
  onCanopyImage,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [aerialReady, setAerialReady] = useState(false);
  const scannedFor = useRef<string | null>(null);

  useEffect(() => {
    setAerialReady(false);
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

  useEffect(() => {
    if (!uri || frameOn) return;
    void runCanopyScan(uri);
  }, [uri, frameOn, runCanopyScan]);

  const acceptFile = (file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
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

  const showAerial = Boolean(uri) && !frameOn;

  return (
    <div
      className={css.slot}
      data-testid="aerial-image-slot"
      data-filled={uri ? "true" : "false"}
      data-ground="tactile-parchment"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        acceptFile(e.dataTransfer.files?.[0] ?? null);
      }}
      onClick={() => {
        if (!uri) inputRef.current?.click();
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className={css.file}
        onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
      />

      <TactileGround
        zoom={zoom}
        sheetScaleDenom={sheetScaleDenom}
        parchmentPeel={parchmentPeel}
        hasAerial={showAerial && aerialReady}
        darkOn={darkOn}
        boundary={boundary}
        building={building}
        siteLabel={siteLabel}
        address={address ?? siteLabel}
      />

      {uri ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={uri}
          alt=""
          className={`${css.img}${aerialReady ? ` ${css.imgReady}` : ""}`}
          style={{
            opacity: frameOn
              ? 0
              : !aerialReady
                ? 0
                : dimmed
                  ? 0.7
                  : Math.max(0.55, 1 - parchmentPeel * 0.35),
          }}
          draggable={false}
          onLoad={() => setAerialReady(true)}
        />
      ) : null}

      {!uri ? (
        <div
          className={`${css.dropCue}${dragOver ? ` ${css.dropCueHot}` : ""}`}
          data-testid="aerial-drop-cue"
        >
          Drop a top-down aerial to ground this site
          <span>Parchment stays as a soft underlay</span>
        </div>
      ) : null}

      {scanning ? (
        <div className={css.scanPill} data-testid="canopy-scanning">
          <span className={css.scanDot} />
          AI scanning aerial for canopy…
        </div>
      ) : null}
    </div>
  );
}
