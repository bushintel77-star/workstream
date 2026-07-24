"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { BoardShadowCast } from "@workstream/domain";
import { SUN_SHADOW, type SunShadowView, viewFromCast } from "./renderTokens";

const SunShadowContext = createContext<SunShadowView>({
  dxPct: SUN_SHADOW.dxPct,
  dyPct: SUN_SHADOW.dwellingDyPct,
  dxFactor: 0,
  dyFactor: SUN_SHADOW.dyFactor,
  opacity: SUN_SHADOW.opacity,
  nightOpacity: SUN_SHADOW.nightOpacity,
});

export function SunShadowProvider({
  cast,
  children,
}: {
  cast: BoardShadowCast | null;
  children: ReactNode;
}) {
  return (
    <SunShadowContext.Provider value={viewFromCast(cast)}>
      {children}
    </SunShadowContext.Provider>
  );
}

export function useSunShadow(): SunShadowView {
  return useContext(SunShadowContext);
}
