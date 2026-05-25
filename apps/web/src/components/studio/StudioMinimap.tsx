"use client";

import { useStudioChromeOptional } from "./StudioChromeContext";
import mm from "./studioMinimap.module.css";

type Props = {
  aerialSrc: string;
};

/** Viewport overview — hidden at zoom ≤ 100%. */
export function StudioMinimap({ aerialSrc }: Props) {
  const chrome = useStudioChromeOptional();
  if (!chrome || chrome.zoomPercent <= 100) return null;

  return (
    <div className={mm.wrap} aria-hidden data-testid="studio-minimap">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={aerialSrc} alt="" className={mm.thumb} />
      <div className={mm.viewportRect} />
      <span className={mm.label}>{chrome.zoomPercent}%</span>
    </div>
  );
}
