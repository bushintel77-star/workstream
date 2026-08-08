"use client";

import type { ImageLayer } from "@workstream/contracts";
import css from "./imageLayerSlot.module.css";

type Props = {
  layers: ImageLayer[];
};

/**
 * Renders image underlays inside the camera transform so they scale, pan and
 * rotate with the board. Sketch ink lives above this in SketchBoard.
 */
export function ImageLayerSlot({ layers }: Props) {
  if (layers.length === 0) return null;
  return (
    <div
      className={css.slot}
      data-testid="image-layer-slot"
      aria-label="Image underlays"
    >
      {layers.map((layer) =>
        layer.visible ? (
          <img
            key={layer.id}
            className={css.image}
            src={layer.uri}
            alt={layer.name}
            data-testid={`image-layer-${layer.id}`}
            draggable={false}
            style={{
              left: `${layer.x_pct}%`,
              top: `${layer.y_pct}%`,
              width: `${layer.width_pct}%`,
              opacity: layer.opacity,
              transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
              mixBlendMode: layer.blend_mode,
              pointerEvents: layer.locked ? "none" : "auto",
            }}
          />
        ) : null,
      )}
    </div>
  );
}
