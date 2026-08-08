import type { IrrigationZone, SpatialObject } from "@workstream/contracts";

export type LightingAssistPoint = {
  id: string;
  fixture: string;
  x_pct: number;
  y_pct: number;
  count: number;
};

/** First-pass drip zones from open-space heuristics (editable layer). */
export function proposeIrrigationAssist(args: {
  projectId?: string;
  openAreaM2?: number;
  idFactory?: () => string;
}): IrrigationZone[] {
  const id = args.idFactory ?? (() => crypto.randomUUID());
  const area = args.openAreaM2 ?? 80;
  const zones: IrrigationZone[] = [
    {
      id: id(),
      name: "Rear drip zone",
      points: [
        { x_pct: 22, y_pct: 55 },
        { x_pct: 78, y_pct: 55 },
        { x_pct: 78, y_pct: 82 },
        { x_pct: 22, y_pct: 82 },
      ],
      emitter_spacing_cm: 30,
      emitter_flow_lph: 2,
    },
  ];
  if (area >= 120) {
    zones.push({
      id: id(),
      name: "Front drip zone",
      points: [
        { x_pct: 18, y_pct: 12 },
        { x_pct: 70, y_pct: 12 },
        { x_pct: 70, y_pct: 32 },
        { x_pct: 18, y_pct: 32 },
      ],
      emitter_spacing_cm: 35,
      emitter_flow_lph: 2,
    });
  }
  return zones;
}

/** Place brass uplights near softscape trees (max 4). */
export function proposeLightingAssist(
  facts: SpatialObject[],
  idFactory: () => string = () => crypto.randomUUID(),
): LightingAssistPoint[] {
  const trees = facts.filter(
    (f) =>
      f.layer === "softscape" &&
      (f.symbol_id?.includes("tree") ||
        f.label.toLowerCase().includes("tree") ||
        (f.mature_canopy_m ?? 0) > 0),
  );
  return trees.slice(0, 4).map((t, i) => ({
    id: idFactory(),
    fixture: "Brass uplight",
    x_pct: Math.min(98, (t.x_pct ?? 50) + 1.2),
    y_pct: Math.min(98, (t.y_pct ?? 50) + 1.2),
    count: 1 + (i % 2),
  }));
}
