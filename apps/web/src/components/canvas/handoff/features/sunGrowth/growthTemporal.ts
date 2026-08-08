import type { GrowthStage } from "../../state/studioTypes";

/** Temporal growth stages — UI copy is Year N; ids stay plant/5yr/mature. */
export const GROWTH_TEMPORAL_STAGES: ReadonlyArray<{
  id: GrowthStage;
  label: string;
  year: number;
}> = [
  { id: "plant", label: "Year 1", year: 1 },
  { id: "5yr", label: "Year 5", year: 5 },
  { id: "mature", label: "Year 10", year: 10 },
];

export function growthStageIndex(growth: GrowthStage): number {
  const i = GROWTH_TEMPORAL_STAGES.findIndex((s) => s.id === growth);
  return i >= 0 ? i : 0;
}

export function growthStageFromIndex(index: number): GrowthStage {
  const clamped = Math.max(
    0,
    Math.min(GROWTH_TEMPORAL_STAGES.length - 1, Math.round(index)),
  );
  return GROWTH_TEMPORAL_STAGES[clamped]!.id;
}

export function growthStageLabel(growth: GrowthStage): string {
  return (
    GROWTH_TEMPORAL_STAGES.find((s) => s.id === growth)?.label ?? "Year 1"
  );
}
