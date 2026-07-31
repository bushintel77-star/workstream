"use client";

import { useMediaQuery } from "./useMediaQuery";

/**
 * Studio chrome layout — phone vs desktop.
 * Narrow viewports always get phone chrome; coarse pointers on tablets
 * (≤960px) also get the thumb-first shell. Desktop denseness is preserved
 * above those breakpoints.
 */
export const STUDIO_PHONE_MQ =
  "(max-width: 720px), ((pointer: coarse) and (max-width: 960px))";

export type StudioLayout = "phone" | "desktop";

/** Nominal bottom sheet height reserved into `--ws-safe-bottom` on phone. */
export const PHONE_DATA_SHEET_HEIGHT_PX = 360;

/** Tool dock strip height (chips + padding + home indicator clearance). */
export const PHONE_TOOL_DOCK_CLEARANCE_PX = 88;

export function useStudioLayout(): StudioLayout {
  const phone = useMediaQuery(STUDIO_PHONE_MQ);
  return phone ? "phone" : "desktop";
}
