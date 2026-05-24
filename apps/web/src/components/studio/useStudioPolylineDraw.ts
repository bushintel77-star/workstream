import { useCallback, useState } from "react";
import type { CanvasPointPct } from "@workstream/contracts";

export type PolylineDrawMode = "open" | "closed";

export function useStudioPolylineDraw(mode: PolylineDrawMode = "open") {
  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState<CanvasPointPct[]>([]);

  const start = useCallback(() => {
    setIsDrawing(true);
    setPoints([]);
  }, []);

  const cancel = useCallback(() => {
    setIsDrawing(false);
    setPoints([]);
  }, []);

  const addPoint = useCallback((pt: CanvasPointPct) => {
    setPoints((prev) => [...prev, pt]);
  }, []);

  const finish = useCallback((): CanvasPointPct[] | null => {
    const minPoints = mode === "closed" ? 3 : 2;
    if (points.length < minPoints) return null;
    const result = [...points];
    setIsDrawing(false);
    setPoints([]);
    return result;
  }, [mode, points]);

  return {
    isDrawing,
    points,
    start,
    cancel,
    addPoint,
    finish,
    mode,
  };
}
