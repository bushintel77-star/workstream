import type { CanvasMode } from "../../../../lib/canvas-mode";
import type { AnnotationDialect } from "./model";

export interface CommunicationModeProfile {
  title: string;
  modes: AnnotationDialect[];
  labels: Record<AnnotationDialect, string>;
  defaultDialect: AnnotationDialect;
}

const BASE_LABELS: Record<AnnotationDialect, string> = {
  technical: "Technical",
  architectural: "Architectural",
  creative: "Creative",
  hybrid: "Hybrid",
};

export function communicationProfileForMode(
  mode: CanvasMode,
): CommunicationModeProfile | null {
  if (mode === "survey") {
    return {
      title: "Survey communication",
      modes: ["technical", "architectural", "hybrid"],
      labels: {
        ...BASE_LABELS,
        technical: "Surveyed plan",
        architectural: "Design sketch",
      },
      defaultDialect: "technical",
    };
  }
  if (mode === "cad") {
    return {
      title: "CAD communication",
      modes: ["architectural", "technical", "hybrid"],
      labels: {
        ...BASE_LABELS,
        hybrid: "Presentation blend",
      },
      defaultDialect: "architectural",
    };
  }
  if (mode === "sketch") {
    return {
      title: "Sketch communication",
      modes: ["creative", "architectural", "technical"],
      labels: BASE_LABELS,
      defaultDialect: "creative",
    };
  }
  return null;
}
