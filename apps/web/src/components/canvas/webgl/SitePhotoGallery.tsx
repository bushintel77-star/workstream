"use client";

/**
 * Gold Standard 2026 — Site Photo Gallery (the photo-trace elevation source).
 *
 * Lives in the studio meta tab. The operator uploads on-site photos (street
 * frontage, rear fence, side boundary); each one can be pinned as a frozen
 * calibrated camera frame, calibrated, viewed as an elevation sheet, or
 * deleted. Uploads measure natural aspect client-side (the browser's Image
 * decoder is authoritative) and attach to the survey's site_photos gallery.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { PhotoElevation, SitePhoto } from "@workstream/contracts";
import { useStudioStore } from "./studioStore";
import { facadeNormalAzimuthDeg } from "./cameraRig";
import type { PctPoint } from "./coordTransform";
import {
  newPhotoElevation,
  snapPhotoPlaneToBoundary,
} from "./photoTraceMath";

const chip: React.CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: "var(--gs-font-xs)",
  letterSpacing: "0.04em",
  padding: "2px 8px",
  borderRadius: "var(--gs-radius-pill)",
  border: "1px solid color-mix(in srgb, var(--gs-line) 55%, transparent)",
  color: "var(--gs-ink-secondary)",
  whiteSpace: "nowrap",
  background: "transparent",
  cursor: "pointer",
};

const primaryChip: React.CSSProperties = {
  ...chip,
  border: "1px solid color-mix(in srgb, var(--gs-primary) 45%, transparent)",
  background: "color-mix(in srgb, var(--gs-primary) 12%, transparent)",
  color: "var(--gs-primary)",
};

export function SitePhotoGallery({
  projectId,
  boundaryPct,
  scaleM,
  boardAspect,
  onViewSheet,
  onClose,
}: {
  projectId: string;
  /** Title boundary ring (board-%) — the photo plane snaps onto it at pin. */
  boundaryPct: PctPoint[];
  scaleM: number;
  boardAspect: number;
  /** Open a photo elevation sheet (the print artifact). */
  onViewSheet: (elevationId: string) => void;
  onClose: () => void;
}) {
  const [photos, setPhotos] = useState<SitePhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const photoElevations = useStudioStore((s) => s.photoElevations);
  const removePhotoElevation = useStudioStore((s) => s.removePhotoElevation);
  const setPhotoTraceSession = useStudioStore((s) => s.setPhotoTraceSession);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/site-photos`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? `Could not load photos (${res.status})`);
      }
      const body = (await res.json()) as { photos: SitePhoto[] };
      setPhotos(body.photos ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load photos");
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const upload = useCallback(
    async (file: File) => {
      setBusy(true);
      setError(null);
      try {
        // Measure the natural aspect with the browser's Image decoder —
        // the server has none, and this value is authoritative.
        const aspect = await new Promise<number>((resolve, reject) => {
          const url = URL.createObjectURL(file);
          const img = new Image();
          img.onload = () => {
            URL.revokeObjectURL(url);
            const a = img.naturalWidth / Math.max(1, img.naturalHeight);
            resolve(a > 0 ? a : 1);
          };
          img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Could not read the image"));
          };
          img.src = url;
        });
        const body = new FormData();
        body.append("name", file.name.replace(/\.[^.]+$/, "").slice(0, 200));
        body.append("natural_aspect", String(aspect));
        body.append("file", file);
        const res = await fetch(`/api/projects/${projectId}/site-photos`, {
          method: "POST",
          body,
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(payload?.error ?? `Upload failed (${res.status})`);
        }
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setBusy(false);
      }
    },
    [projectId, refresh],
  );

  const elevationFor = (photoId: string): PhotoElevation | null =>
    photoElevations.find((e) => e.photo_id === photoId) ?? null;

  const pinPhoto = (photo: SitePhoto, mode: "trace" | "calibrate") => {
    const existing = elevationFor(photo.id);
    if (!existing) {
      // Gap-check rule: anything physically sited on the property reconciles
      // with the title boundary polygon. The plane snaps onto the boundary
      // edge the camera is facing (operator intent — rotate the plan to face
      // the fence, then pin); the edge's real bearing becomes the plane
      // azimuth. Without a boundary the plane keeps the default centre and
      // is stamped locational-indicative.
      const store = useStudioStore.getState();
      const rig = store.liveRig;
      const currentAzimuth = rig.rotateDeg;
      const snap = snapPhotoPlaneToBoundary({
        boundaryPct,
        scaleM,
        boardAspect,
        cameraAzimuthDeg: currentAzimuth,
        cameraTargetXM: rig.panX,
        cameraTargetZM: rig.panY,
      });
      const elevation = newPhotoElevation(
        photo,
        snap
          ? snap.azimuthDeg
          : facadeNormalAzimuthDeg(currentAzimuth) ??
              Math.round(currentAzimuth / 90) * 90,
        snap
          ? {
              centreXM: snap.centreXM,
              centreZM: snap.centreZM,
              boundarySnap: {
                edge_index: snap.edgeIndex,
                snapped_at: new Date().toISOString(),
              },
            }
          : undefined,
      );
      store.upsertPhotoElevation(elevation);
      setPhotoTraceSession({ elevationId: elevation.id, mode });
    } else {
      setPhotoTraceSession({ elevationId: existing.id, mode });
    }
    onClose(); // zero-chrome — the drawing is the product
  };

  const deletePhoto = async (photo: SitePhoto) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/site-photos/${photo.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? `Delete failed (${res.status})`);
      }
      const elevation = elevationFor(photo.id);
      if (elevation) removePhotoElevation(elevation.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="site-photo-gallery"
      style={{ display: "flex", flexDirection: "column", gap: "var(--gs-space-4)" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--gs-space-4)" }}>
        <span
          style={{
            fontFamily: "var(--font-tech)",
            fontSize: "var(--gs-font-xs)",
            fontWeight: 600,
            letterSpacing: "0.06em",
            color: "var(--gs-ink)",
          }}
        >
          SITE PHOTOS
        </span>
        <span
          style={{
            fontFamily: "var(--font-tech)",
            fontSize: "var(--gs-font-xs)",
            color: "var(--gs-ink-secondary)",
          }}
        >
          {photos.length} uploaded
        </span>
      </div>
      <button
        type="button"
        data-testid="site-photo-upload"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        style={primaryChip}
      >
        {busy ? "Uploading…" : "Upload a site photo"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        hidden
        aria-label="Choose a site photo"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.currentTarget.value = "";
        }}
      />
      {error ? (
        <p
          role="alert"
          data-testid="site-photo-error"
          style={{ margin: 0, color: "var(--gs-ink-conflict)", fontSize: "var(--gs-font-sm)" }}
        >
          {error}
        </p>
      ) : null}
      {photos.length === 0 ? (
        <p style={{ margin: 0, color: "var(--gs-ink-secondary)", fontSize: "var(--gs-font-sm)" }}>
          No site photos yet. Upload the street frontage, rear fence or side
          boundary to trace an elevation from a photo.
        </p>
      ) : (
        <ul
          style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--gs-space-3)" }}
        >
          {photos.map((photo) => {
            const elevation = elevationFor(photo.id);
            const stamp = elevation?.calibration
              ? `Calibrated against ${elevation.calibration.label}`
              : elevation
                ? "Pinned — uncalibrated (traces indicative)"
                : null;
            const locational = elevation
              ? elevation.boundary_snap
                ? "on the title boundary"
                : "position not verified against the title boundary"
              : null;
            return (
              <li
                key={photo.id}
                data-testid="site-photo-row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--gs-space-4)",
                  padding: 6,
                  borderRadius: "var(--gs-radius-chip)",
                  border: "1px solid color-mix(in srgb, var(--gs-line) 55%, transparent)",
                }}
              >
                {/* Gallery thumbnails are project uploads, not layout art. */}
                <img
                  src={photo.uri}
                  alt={photo.name}
                  style={{
                    width: 44,
                    height: 33,
                    objectFit: "cover",
                    borderRadius: "var(--gs-radius-sm)",
                    border: "1px solid var(--gs-line)",
                    background: "var(--gs-panel)",
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "var(--gs-font-sm)",
                      color: "var(--gs-ink)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {photo.name}
                  </div>
                  {stamp ? (
                    <div
                      data-testid="site-photo-stamp"
                      style={{
                        fontSize: "var(--gs-font-xs)",
                        color: elevation?.calibration
                          ? "var(--gs-ink-secondary)"
                          : "var(--gs-ink-muted)",
                      }}
                    >
                      {stamp}
                      {locational ? ` · ${locational}` : ""}
                    </div>
                  ) : null}
                </div>
                <div style={{ display: "flex", gap: "var(--gs-space-2)", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    data-testid="site-photo-pin"
                    onClick={() => pinPhoto(photo, "trace")}
                    style={primaryChip}
                  >
                    Pin to trace
                  </button>
                  <button
                    type="button"
                    data-testid="site-photo-calibrate"
                    onClick={() => pinPhoto(photo, "calibrate")}
                    style={chip}
                  >
                    Calibrate
                  </button>
                  {elevation ? (
                    <button
                      type="button"
                      data-testid="site-photo-sheet"
                      onClick={() => onViewSheet(elevation.id)}
                      style={chip}
                    >
                      Sheet
                    </button>
                  ) : null}
                  <button
                    type="button"
                    aria-label={`Delete ${photo.name}`}
                    data-testid="site-photo-delete"
                    disabled={busy}
                    onClick={() => void deletePhoto(photo)}
                    style={{ ...chip, color: "var(--gs-ink-conflict)" }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
