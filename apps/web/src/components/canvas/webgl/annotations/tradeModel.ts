import type { AnnotationDialect } from "./model";

export type TradePackId =
  | "irrigationDrainage"
  | "hardscapeConstruction"
  | "lightingElectrical";

export interface TradeLine {
  id: string;
  pack: TradePackId;
  pointsPct: Array<{ x: number; y: number }>;
  label: string;
  code: string;
}

export interface TradeCallout {
  id: string;
  pack: TradePackId;
  atPct: { x: number; y: number };
  code: string;
  text: string;
}

export interface TradeLegendEntry {
  id: string;
  pack: TradePackId;
  label: string;
  value: string;
}

export interface TradePackModel {
  dialect: AnnotationDialect;
  lines: TradeLine[];
  callouts: TradeCallout[];
  legend: TradeLegendEntry[];
}
