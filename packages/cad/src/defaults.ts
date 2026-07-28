import type { CadDocument, CadLayer } from "@workstream/contracts";

export const DEFAULT_CAD_LAYERS: CadLayer[] = [
  { name: "SHEET", color: 9 },
  { name: "SKETCH-REF", color: 8 },
  { name: "PLANTING", color: 3 },
  { name: "HARDSCAPE", color: 7 },
  { name: "STRUCTURES", color: 4 },
  { name: "WATER", color: 5 },
  { name: "IRRIGATION", color: 140 },
  { name: "SERVICES", color: 150 },
  { name: "TRP", color: 1 },
  { name: "ANNOTATION", color: 2 },
  { name: "DIMENSIONS", color: 6 },
  { name: "PERMITS", color: 30 },
];

export function emptyCadDocument(args: {
  projectId: string;
  width_m: number;
  height_m: number;
  source_sketch_id?: string | null;
}): Omit<CadDocument, "id" | "updated_at"> & {
  id?: string;
  updated_at?: string;
} {
  return {
    project_id: args.projectId,
    version: 1,
    units: "m",
    origin: { x: 0, y: 0 },
    width_m: args.width_m,
    height_m: args.height_m,
    layers: DEFAULT_CAD_LAYERS.map((l) => ({ ...l })),
    entities: [],
    blocks: [],
    ai_run_id: null,
    source_sketch_id: args.source_sketch_id ?? null,
  };
}
