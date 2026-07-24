import type {
  StudioComplianceItem,
  StudioEstimateReport,
} from "@workstream/domain";

/** Serializable args for estimateStudioDrawing (worker + main-thread fallback). */
export type StudioEstimateArgs = {
  outdoorM2: number;
  boundary: Array<{ x: number; y: number }>;
  items: StudioComplianceItem[];
  metaByType?: Record<
    string,
    {
      rate: number;
      wPx: number;
      hPx: number;
      areaKind?: "rect" | "ellipse" | "none";
      heightM?: number;
      lin?: boolean;
      existing?: boolean;
      dbhM?: number;
      canopyM?: number;
    }
  >;
  accessConstrained?: boolean;
  scaleM?: number;
  irrigationZones?: Array<{
    id: string;
    name: string;
    kind?: "drip" | "lighting" | "lighting_conduit" | "spray" | "agg_drain";
    points: Array<{ x_pct: number; y_pct: number }>;
    emitter_spacing_cm?: number;
    emitter_flow_lph?: number;
    fixture_spacing_m?: number;
  }>;
};

export type StudioEstimateWorkerRequest = {
  type: "estimate_studio";
  requestId: string;
  args: StudioEstimateArgs;
};

export type StudioEstimateWorkerResponse = {
  type: "estimate_studio_result";
  requestId: string;
  report: StudioEstimateReport;
};
