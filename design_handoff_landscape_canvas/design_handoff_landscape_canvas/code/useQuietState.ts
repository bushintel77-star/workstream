/** Pen-down quiet state (4d) + the motion rule underneath everything (13b):
 *  THINGS THE HAND IS ON NEVER MOVE. Chrome animates opacity; geometry interpolates;
 *  position animation belongs to the camera alone. Animating the ribbon's x here would be a defect. */
import { useEffect, useRef, useState } from 'react';

export const QUIET_IN_MS = 120;
export const QUIET_RESTORE_DELAY_MS = 240;
export const QUIET_OUT_MS = 180;

/** Opacity targets while the pen is down. No transforms, no layout, no position. */
export const QUIET_OPACITY = {
  ribbon: 1,          // stays lit, but narrows to the 56px rail
  wfsChips: 0.2,
  cameraDock: 0,
  cornerReadouts: 0,
  perimeterTrack: 0.05,
  nibReadout: 1,      // the only element that stays fully live
} as const;

export function useQuietState(isPenDown: boolean, prefersReducedMotion = false) {
  const [quiet, setQuiet] = useState(false);
  const timer = useRef<number>();

  useEffect(() => {
    window.clearTimeout(timer.current);
    if (isPenDown) { setQuiet(true); return; }
    timer.current = window.setTimeout(() => setQuiet(false), QUIET_RESTORE_DELAY_MS);
    return () => window.clearTimeout(timer.current);
  }, [isPenDown]);

  const ms = prefersReducedMotion ? 0 : quiet ? QUIET_IN_MS : QUIET_OUT_MS;

  /** Spread onto any chrome element. Note: transition is opacity ONLY, by contract. */
  const chromeStyle = (key: keyof typeof QUIET_OPACITY): React.CSSProperties => ({
    opacity: quiet ? QUIET_OPACITY[key] : 1,
    transition: `opacity ${ms}ms cubic-bezier(.32,.72,0,1)`,
    pointerEvents: quiet && QUIET_OPACITY[key] === 0 ? 'none' : undefined,
  });

  return { quiet, chromeStyle, ribbonWidth: quiet ? 56 : 88 };
}
