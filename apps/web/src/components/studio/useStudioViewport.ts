"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 16;
const ZOOM_STEP = 1.15;

export type StudioViewport = {
  zoom: number;
  panX: number;
  panY: number;
  zoomPercent: number;
  isPanMode: boolean;
  spacePan: boolean;
  stageStyle: React.CSSProperties;
  clientToPct: (clientX: number, clientY: number) => { x_pct: number; y_pct: number };
  pctDeltaFromScreen: (dxPx: number, dyPx: number) => { dx: number; dy: number };
  placementCenterClient: (
    xPct: number,
    yPct: number,
  ) => { cx: number; cy: number } | null;
  onWheel: (e: React.WheelEvent) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  fitView: () => void;
  beginPan: (clientX: number, clientY: number) => void;
  movePan: (clientX: number, clientY: number) => void;
  endPan: () => void;
  isPanning: boolean;
};

function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

export function useStudioViewport(
  containerRef: RefObject<HTMLDivElement | null>,
): StudioViewport {
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [spacePan, setSpacePan] = useState(false);
  const panDrag = useRef<{
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setSpacePan(true);
      }
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        setZoom((z) => clampZoom(z * ZOOM_STEP));
      }
      if (e.key === "-") {
        e.preventDefault();
        setZoom((z) => clampZoom(z / ZOOM_STEP));
      }
      if (e.key === "0") {
        e.preventDefault();
        setZoom(1);
        setPanX(0);
        setPanY(0);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpacePan(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const clientToPct = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el) return { x_pct: 50, y_pct: 50 };
      const rect = el.getBoundingClientRect();
      const x = (clientX - rect.left - panX) / zoom;
      const y = (clientY - rect.top - panY) / zoom;
      return {
        x_pct: Math.min(100, Math.max(0, (x / rect.width) * 100)),
        y_pct: Math.min(100, Math.max(0, (y / rect.height) * 100)),
      };
    },
    [containerRef, panX, panY, zoom],
  );

  const pctDeltaFromScreen = useCallback(
    (dxPx: number, dyPx: number) => {
      const el = containerRef.current;
      if (!el) return { dx: 0, dy: 0 };
      const rect = el.getBoundingClientRect();
      return {
        dx: (dxPx / zoom / rect.width) * 100,
        dy: (dyPx / zoom / rect.height) * 100,
      };
    },
    [containerRef, zoom],
  );

  const placementCenterClient = useCallback(
    (xPct: number, yPct: number) => {
      const el = containerRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        cx: rect.left + panX + (xPct / 100) * rect.width * zoom,
        cy: rect.top + panY + (yPct / 100) * rect.height * zoom,
      };
    },
    [containerRef, panX, panY, zoom],
  );

  const zoomAt = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      setZoom((prev) => {
        const next = clampZoom(prev * factor);
        const scale = next / prev;
        setPanX((px) => mx - scale * (mx - px));
        setPanY((py) => my - scale * (my - py));
        return next;
      });
    },
    [containerRef],
  );

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      zoomAt(e.clientX, e.clientY, factor);
    },
    [zoomAt],
  );

  const zoomIn = useCallback(() => {
    const el = containerRef.current;
    if (!el) {
      setZoom((z) => clampZoom(z * ZOOM_STEP));
      return;
    }
    const rect = el.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, ZOOM_STEP);
  }, [containerRef, zoomAt]);

  const zoomOut = useCallback(() => {
    const el = containerRef.current;
    if (!el) {
      setZoom((z) => clampZoom(z / ZOOM_STEP));
      return;
    }
    const rect = el.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1 / ZOOM_STEP);
  }, [containerRef, zoomAt]);

  const resetView = useCallback(() => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  }, []);

  const fitView = useCallback(() => {
    resetView();
  }, [resetView]);

  const beginPan = useCallback(
    (clientX: number, clientY: number) => {
      panDrag.current = {
        startX: clientX,
        startY: clientY,
        startPanX: panX,
        startPanY: panY,
      };
      setIsPanning(true);
    },
    [panX, panY],
  );

  const movePan = useCallback((clientX: number, clientY: number) => {
    const d = panDrag.current;
    if (!d) return;
    setPanX(d.startPanX + (clientX - d.startX));
    setPanY(d.startPanY + (clientY - d.startY));
  }, []);

  const endPan = useCallback(() => {
    panDrag.current = null;
    setIsPanning(false);
  }, []);

  const isPanMode = spacePan;

  const stageStyle: React.CSSProperties = {
    transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
    transformOrigin: "0 0",
    width: "100%",
    height: "100%",
    position: "relative",
    willChange: "transform",
  };

  return {
    zoom,
    panX,
    panY,
    zoomPercent: Math.round(zoom * 100),
    isPanMode,
    spacePan,
    stageStyle,
    clientToPct,
    pctDeltaFromScreen,
    placementCenterClient,
    onWheel,
    zoomIn,
    zoomOut,
    resetView,
    fitView,
    beginPan,
    movePan,
    endPan,
    isPanning,
  };
}
