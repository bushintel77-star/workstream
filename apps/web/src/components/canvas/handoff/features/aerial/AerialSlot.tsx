"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  onUri: (uri: string | null) => void;
  onScanning: (v: boolean) => void;
  /** Preferred path — AI engine runs canopy clustering. */
  onCanopyImage: (image: CanopyImagePayload) => void;
};

/**
 * Aerial drag-and-drop slot. On fill, samples pixels and hands them to the
 * studio AI engine for canopy proposals (not a local bolt-on mapper).
 */
export function AerialSlot({
  uri,
  dimmed,
  frameOn,
  scanning,
  onUri,
  onScanning,
  onCanopyImage,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const scannedFor = useRef<string | null>(null);

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

  return (
    <div
      className={css.slot}
      data-testid="aerial-image-slot"
      data-filled={uri ? "true" : "false"}
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
      {uri ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={uri}
          alt=""
          className={css.img}
          style={{ opacity: frameOn ? 0 : dimmed ? 0.78 : 1 }}
          draggable={false}
        />
      ) : (
        <div className={`${css.empty}${dragOver ? ` ${css.emptyHot}` : ""}`}>
          Drop Mapbox aerial screenshot here (2D top-down)
          <br />
          or browse files
        </div>
      )}
      {scanning ? (
        <div className={css.scanPill} data-testid="canopy-scanning">
          <span className={css.scanDot} />
          AI scanning aerial for canopy…
        </div>
      ) : null}
    </div>
  );
}
