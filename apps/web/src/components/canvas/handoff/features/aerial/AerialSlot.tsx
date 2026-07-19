"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { detectCanopyClustersFromImageData } from "@workstream/domain";
import type { StudioItem } from "../../studioCatalog";
import css from "./aerialSlot.module.css";

type Props = {
  uri: string | null;
  dimmed: boolean;
  frameOn: boolean;
  scanning: boolean;
  onUri: (uri: string | null) => void;
  onScanning: (v: boolean) => void;
  onCanopyGhosts: (ghosts: StudioItem[]) => void;
};

/**
 * Aerial drag-and-drop slot. On fill, runs heuristic canopy colour clustering
 * (96×96 sample → 24×24 grid) and emits canopy ghosts into studio state.
 */
export function AerialSlot({
  uri,
  dimmed,
  frameOn,
  scanning,
  onUri,
  onScanning,
  onCanopyGhosts,
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
        const clusters = detectCanopyClustersFromImageData(
          { width: size, height: size, data: data.data },
          { gridSize: 24, maxClusters: 6, symbolId: "canopy" },
        );
        const ghosts: StudioItem[] = clusters.map((c, i) => ({
          id: `canopy-aerial-${i + 1}`,
          t: "canopy" as const,
          x: c.x_pct,
          y: c.y_pct,
          rot: 0,
          scale: Math.max(0.5, Math.min(1.3, 0.5 + c.confidence * 0.9)),
          ghost: true,
          why: c.reason,
          conf: c.confidence,
        }));
        if (ghosts.length) onCanopyGhosts(ghosts);
      } catch {
        /* heuristic best-effort */
      } finally {
        onScanning(false);
      }
    },
    [onCanopyGhosts, onScanning],
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
          Scanning aerial for canopy…
        </div>
      ) : null}
    </div>
  );
}
