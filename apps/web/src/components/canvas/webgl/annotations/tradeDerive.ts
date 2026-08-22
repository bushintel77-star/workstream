import type {
  CatalogPlacement,
  ConstructionTrench,
  IrrigationZone,
  LandscapeFeature,
} from "@workstream/contracts";
import type { AnnotationDialect } from "./model";
import type { TradeCallout, TradeLegendEntry, TradeLine, TradePackModel } from "./tradeModel";

function trenchCode(kind: ConstructionTrench["kind"], i: number): string {
  const prefix =
    kind === "drainage"
      ? "DR"
      : kind === "irrig_main"
        ? "IM"
        : kind === "irrig_lateral"
          ? "IL"
          : "LC";
  return `${prefix}-${String(i + 1).padStart(2, "0")}`;
}

function centroid(points: Array<{ x_pct: number; y_pct: number }>): { x: number; y: number } {
  if (points.length === 0) return { x: 50, y: 50 };
  const sum = points.reduce(
    (acc, point) => ({ x: acc.x + point.x_pct, y: acc.y + point.y_pct }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function lightingPlacements(placements: CatalogPlacement[]): CatalogPlacement[] {
  return placements.filter((placement) =>
    /light|bollard|uplight|led|spot/i.test(placement.symbol_id),
  );
}

export function deriveTradePackModel(params: {
  dialect: AnnotationDialect;
  packs: {
    irrigationDrainage: boolean;
    hardscapeConstruction: boolean;
    lightingElectrical: boolean;
  };
  trenches: ConstructionTrench[];
  zones: IrrigationZone[];
  features: LandscapeFeature[];
  placements: CatalogPlacement[];
  density: "compact" | "full";
}): TradePackModel {
  const { dialect, packs, trenches, zones, features, placements, density } = params;
  const lines: TradeLine[] = [];
  const callouts: TradeCallout[] = [];
  const legend: TradeLegendEntry[] = [];

  if (packs.irrigationDrainage) {
    const trenchSet = trenches.filter((t) =>
      t.kind === "drainage" || t.kind === "irrig_main" || t.kind === "irrig_lateral",
    );
    trenchSet.slice(0, density === "compact" ? 6 : trenchSet.length).forEach((trench, idx) => {
      const code = trenchCode(trench.kind, idx);
      lines.push({
        id: `trade-trench-${trench.id}`,
        pack: "irrigationDrainage",
        pointsPct: trench.points.map((point) => ({ x: point.x_pct, y: point.y_pct })),
        label: `${code} ${trench.name}`,
        code,
      });
      const mid = centroid(trench.points);
      callouts.push({
        id: `trade-trench-callout-${trench.id}`,
        pack: "irrigationDrainage",
        atPct: mid,
        code,
        text:
          trench.kind === "drainage"
            ? "Drain line fall to legal point"
            : "Irrigation run with service clearance",
      });
    });
    zones.slice(0, density === "compact" ? 4 : zones.length).forEach((zone, idx) => {
      const code = `IZ-${String(idx + 1).padStart(2, "0")}`;
      lines.push({
        id: `trade-zone-${zone.id}`,
        pack: "irrigationDrainage",
        pointsPct: zone.points.map((point) => ({ x: point.x_pct, y: point.y_pct })),
        label: `${code} ${zone.name}`,
        code,
      });
      callouts.push({
        id: `trade-zone-callout-${zone.id}`,
        pack: "irrigationDrainage",
        atPct: centroid(zone.points),
        code,
        text:
          dialect === "creative"
            ? "Watering rhythm and planting hydration intent"
            : "Irrigation zone balance and head spacing",
      });
    });
    legend.push(
      {
        id: "trade-irrig-main",
        pack: "irrigationDrainage",
        label: "Irrigation and drainage",
        value: "IM/IL mains-laterals, DR drainage with grade intent",
      },
      {
        id: "trade-irrig-callout",
        pack: "irrigationDrainage",
        label: "Callout phrasing",
        value: "Service clearance, fall direction, install intent",
      },
    );
  }

  if (packs.hardscapeConstruction) {
    const hardscape = features.filter(
      (feature) => feature.metadata.layer === "hardscape" || feature.metadata.layer === "structure",
    );
    hardscape.slice(0, density === "compact" ? 6 : hardscape.length).forEach((feature, idx) => {
      const code = `HS-${String(idx + 1).padStart(2, "0")}`;
      const ring = feature.geometry.points.map((point) => ({
        x: point.pct.x_pct,
        y: point.pct.y_pct,
      }));
      lines.push({
        id: `trade-hardscape-${feature.id}`,
        pack: "hardscapeConstruction",
        pointsPct: ring,
        label: `${code} ${feature.metadata.friendly_name ?? "Hardscape zone"}`,
        code,
      });
      callouts.push({
        id: `trade-hardscape-callout-${feature.id}`,
        pack: "hardscapeConstruction",
        atPct: ring[0] ?? { x: 50, y: 50 },
        code,
        text:
          dialect === "creative"
            ? "Material mood and edge language"
            : "Construction edge setout and build note",
      });
    });
    legend.push(
      {
        id: "trade-hardscape",
        pack: "hardscapeConstruction",
        label: "Hardscape construction",
        value: "HS codes map to paving/deck/build extents",
      },
      {
        id: "trade-hardscape-callout",
        pack: "hardscapeConstruction",
        label: "Callout phrasing",
        value: "Setout, edge condition, or material intent",
      },
    );
  }

  if (packs.lightingElectrical) {
    const lights = lightingPlacements(placements);
    lights.slice(0, density === "compact" ? 8 : lights.length).forEach((placement, idx) => {
      const code = `LT-${String(idx + 1).padStart(2, "0")}`;
      const p = { x: placement.x_pct, y: placement.y_pct };
      lines.push({
        id: `trade-light-${placement.id}`,
        pack: "lightingElectrical",
        pointsPct: [p, { x: p.x + 1.5, y: p.y + 1.5 }],
        label: `${code} ${placement.symbol_id}`,
        code,
      });
      callouts.push({
        id: `trade-light-callout-${placement.id}`,
        pack: "lightingElectrical",
        atPct: p,
        code,
        text:
          dialect === "creative"
            ? "Night scene accent and sightline cue"
            : "Circuit and fixture intent",
      });
    });
    legend.push(
      {
        id: "trade-lighting",
        pack: "lightingElectrical",
        label: "Lighting electrical",
        value: "LT codes map fixture intent and circuit notes",
      },
      {
        id: "trade-light-callout",
        pack: "lightingElectrical",
        label: "Callout phrasing",
        value: "Scene intent or install instruction by mode",
      },
    );
  }

  return {
    dialect,
    lines,
    callouts,
    legend,
  };
}
