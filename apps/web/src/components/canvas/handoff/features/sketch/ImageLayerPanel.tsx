"use client";

import { useCallback, useRef, useState } from "react";
import type { ImageLayer, ProjectFile } from "@workstream/contracts";
import {
  listProjectFilesClient,
  uploadProjectFileClient,
} from "../sitePack/projectFilesClient";
import { rasterizePdfFirstPage } from "./pdfPageUnderlay";
import css from "./imageLayerPanel.module.css";

type Props = {
  projectId: string;
  layers: ImageLayer[];
  onClose: () => void;
  onAdd: (layer: ImageLayer) => void;
  onUpdate: (id: string, patch: Partial<ImageLayer>) => void;
  onRemove: (id: string) => void;
  onSetLayers: (layers: ImageLayer[]) => void;
};

function isImageMime(mime: string) {
  return /^image\/(jpeg|png|webp|jpg)/i.test(mime);
}

function isPdf(file: File) {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

function fitWidthPercent(naturalAspect: number): number {
  const fitBox = 40;
  const board = document.querySelector('[data-testid="studio-board"]') as
    | HTMLElement
    | undefined;
  const boardAspect = board
    ? board.getBoundingClientRect().width /
    Math.max(1, board.getBoundingClientRect().height)
    : 1.5;
  return Math.max(
    1,
    Math.min(fitBox, fitBox * (boardAspect / naturalAspect)),
  );
}

function loadImageMeta(file: File): Promise<{
  naturalAspect: number;
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        naturalAspect: img.naturalWidth / Math.max(1, img.naturalHeight),
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image"));
    };
    img.src = url;
  });
}

export function ImageLayerPanel({
  projectId,
  layers,
  onClose,
  onAdd,
  onUpdate,
  onRemove,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [gallery, setGallery] = useState<ProjectFile[] | null>(null);

  const insertFile = useCallback(
    async (file: File) => {
      setBusy(true);
      try {
        let uploadFile = file;
        let naturalAspect = 1.5;
        let layerName = file.name;
        if (isPdf(file)) {
          const raster = await rasterizePdfFirstPage(file);
          uploadFile = new File([raster.blob], raster.fileName, {
            type: "image/png",
          });
          naturalAspect = raster.naturalAspect;
          layerName = `${file.name} · page 1`;
        } else if (!isImageMime(file.type)) {
          return;
        } else {
          naturalAspect = (await loadImageMeta(file)).naturalAspect;
        }
        const { uri, id, title } = await uploadProjectFileClient(
          projectId,
          uploadFile,
          {
            kind: "reference",
            title: layerName,
          },
        );
        onAdd({
          id: crypto.randomUUID(),
          project_file_id: id,
          name: title || layerName,
          uri,
          natural_aspect: naturalAspect,
          x_pct: 50,
          y_pct: 50,
          width_pct: fitWidthPercent(naturalAspect),
          rotation: 0,
          opacity: 0.5,
          visible: true,
          locked: false,
          blend_mode: "normal",
        });
      } finally {
        setBusy(false);
      }
    },
    [projectId, onAdd],
  );

  const openGallery = useCallback(async () => {
    try {
      const files = await listProjectFilesClient(projectId);
      setGallery(files.filter((f) => isImageMime(f.mime_type)));
    } catch {
      setGallery([]);
    }
  }, [projectId]);

  const insertFromGallery = useCallback(
    async (file: ProjectFile) => {
      if (!isImageMime(file.mime_type)) return;
      setBusy(true);
      try {
        const res = await fetch(file.uri);
        const blob = await res.blob();
        const { naturalAspect } = await loadImageMeta(
          new File([blob], file.title, { type: file.mime_type }),
        );
        onAdd({
          id: crypto.randomUUID(),
          project_file_id: file.id,
          name: file.title,
          uri: file.uri,
          natural_aspect: naturalAspect,
          x_pct: 50,
          y_pct: 50,
          width_pct: fitWidthPercent(naturalAspect),
          rotation: 0,
          opacity: 0.5,
          visible: true,
          locked: false,
          blend_mode: "normal",
        });
      } finally {
        setBusy(false);
      }
    },
    [onAdd],
  );

  return (
    <div className={css.panel} data-testid="image-layer-panel">
      <div className={css.header}>
        <h3 className={css.title}>Image layers</h3>
        <button
          type="button"
          className={css.close}
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className={css.actions}>
        <button
          type="button"
          className={css.action}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          Upload image or PDF
        </button>
        <button
          type="button"
          className={css.action}
          disabled={busy}
          onClick={openGallery}
        >
          From gallery
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf,.pdf"
          data-testid="image-layer-upload"
          className={css.fileInput}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void insertFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {gallery ? (
        <div className={css.gallery}>
          {gallery.length === 0 ? (
            <p className={css.empty}>No images in project gallery.</p>
          ) : (
            gallery.map((f) => (
              <button
                key={f.id}
                type="button"
                className={css.galleryItem}
                onClick={() => void insertFromGallery(f)}
                disabled={busy}
              >
                <img src={f.uri} alt="" aria-hidden="true" className={css.galleryThumb} />
                <span className={css.galleryName}>{f.title}</span>
              </button>
            ))
          )}
        </div>
      ) : null}

      <div className={css.list} role="list">
        {layers.length === 0 ? (
          <p className={css.empty}>
            No image layers yet. Upload a site photo or plan to trace over.
          </p>
        ) : (
          layers.map((layer) => (
            <div key={layer.id} className={css.row} role="listitem">
              <img
                src={layer.uri}
                alt=""
                aria-hidden="true"
                className={css.thumb}
                draggable={false}
              />
              <span className={css.name}>{layer.name}</span>

              <label className={css.srOnly} htmlFor={`opacity-${layer.id}`}>
                Opacity
              </label>
              <input
                id={`opacity-${layer.id}`}
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={layer.opacity}
                className={css.slider}
                onChange={(e) =>
                  onUpdate(layer.id, { opacity: Number(e.target.value) })
                }
              />

              <button
                type="button"
                className={`${css.chip}${layer.visible ? "" : ` ${css.chipOff}`}`}
                onClick={() => onUpdate(layer.id, { visible: !layer.visible })}
                title={layer.visible ? "Hide layer" : "Show layer"}
                aria-pressed={layer.visible}
              >
                {layer.visible ? "Hide" : "Show"}
              </button>

              <button
                type="button"
                className={`${css.chip}${layer.locked ? ` ${css.chipActive}` : ""}`}
                onClick={() => onUpdate(layer.id, { locked: !layer.locked })}
                title={layer.locked ? "Unlock layer" : "Lock layer"}
                aria-pressed={layer.locked}
              >
                {layer.locked ? "Locked" : "Lock"}
              </button>

              <button
                type="button"
                className={css.chip}
                onClick={() => onRemove(layer.id)}
                title="Delete layer"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
