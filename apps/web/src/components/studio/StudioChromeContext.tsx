"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ToolOverride } from "./studioTypes";

export type StudioChromeState = {
  toolOverride: ToolOverride;
  setToolOverride: (tool: ToolOverride) => void;
  railExpanded: boolean;
  setRailExpanded: (v: boolean) => void;
  rightRailOpen: boolean;
  setRightRailOpen: (v: boolean) => void;
  saveStatusText: string;
  saveStatusDotClass: string;
  selectionCount: number;
  symbolCount: number;
  cursorPct: { x: number; y: number } | null;
  setCursorPct: (pct: { x: number; y: number } | null) => void;
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onSave: () => void;
  saving: boolean;
  canUndo: boolean;
  onUndo: () => void;
  canRedo: boolean;
  onRedo: () => void;
};

const StudioChromeContext = createContext<StudioChromeState | null>(null);

export function StudioChromeProvider({
  value,
  children,
}: {
  value: StudioChromeState;
  children: ReactNode;
}) {
  const ctx = useMemo(() => value, [value]);
  return (
    <StudioChromeContext.Provider value={ctx}>{children}</StudioChromeContext.Provider>
  );
}

export function useStudioChrome(): StudioChromeState {
  const ctx = useContext(StudioChromeContext);
  if (!ctx) {
    throw new Error("useStudioChrome requires StudioChromeProvider");
  }
  return ctx;
}

export function useStudioChromeOptional(): StudioChromeState | null {
  return useContext(StudioChromeContext);
}

/** Default chrome for shell-only stubs before DesignStudio mounts. */
export function useStudioChromeStub(): StudioChromeState {
  const [toolOverride, setToolOverride] = useState<ToolOverride>(null);
  const [railExpanded, setRailExpanded] = useState(false);
  const [rightRailOpen, setRightRailOpen] = useState(true);
  const [cursorPct, setCursorPct] = useState<{ x: number; y: number } | null>(null);

  return useMemo(
    () => ({
      toolOverride,
      setToolOverride,
      railExpanded,
      setRailExpanded,
      rightRailOpen,
      setRightRailOpen,
      saveStatusText: "Ready to save",
      saveStatusDotClass: "",
      selectionCount: 0,
      symbolCount: 0,
      cursorPct,
      setCursorPct,
      zoomPercent: 100,
      onZoomIn: () => {},
      onZoomOut: () => {},
      onResetView: () => {},
      onSave: () => {},
      saving: false,
      canUndo: false,
      onUndo: () => {},
      canRedo: false,
      onRedo: () => {},
    }),
    [toolOverride, railExpanded, rightRailOpen, cursorPct],
  );
}
