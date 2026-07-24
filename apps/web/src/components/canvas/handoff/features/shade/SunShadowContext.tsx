"use client";

import { createContext, useContext, type ReactNode } from "react";
import { decorativeGlyphShadowOffset } from "@workstream/domain";

type SunShadowValue = {
  /** Degrees: 0 = north, 90 = east — same as sunPositionAt / cast. */
  azimuthDeg: number;
};

const SunShadowContext = createContext<SunShadowValue>({
  // Default matches legacy static south cast (north sun).
  azimuthDeg: 0,
});

/** Provide live sun azimuth so glyph soft-shadows match SunCastOverlay. */
export function SunShadowProvider({
  azimuthDeg,
  children,
}: {
  azimuthDeg: number;
  children: ReactNode;
}) {
  return (
    <SunShadowContext.Provider value={{ azimuthDeg }}>
      {children}
    </SunShadowContext.Provider>
  );
}

/** Soft ellipse offset under a glyph — opposite-sun, same vector as cast. */
export function useGlyphSunShadow(
  radius: number,
  factor = 0.22,
): { dx: number; dy: number } {
  const { azimuthDeg } = useContext(SunShadowContext);
  return decorativeGlyphShadowOffset(azimuthDeg, radius, factor);
}

export function useSunAzimuthDeg(): number {
  return useContext(SunShadowContext).azimuthDeg;
}
