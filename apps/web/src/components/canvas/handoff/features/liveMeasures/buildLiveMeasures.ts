import { itemFootprintMetres } from "@workstream/domain";
import {
  BY_TYPE,
  type StudioItem,
  type StudioItemType,
} from "../../studioCatalog";
import {
  edgeSegments,
  formatScheduleAreaM2,
  polygonPerimeterM,
  resolveSiteAreaDisplay,
  type EdgeSegment,
  type PctPoint,
  type SiteSchedule,
} from "../../geometry";

export type LiveMeasureRow = {
  id: string;
  label: string;
  value: string;
  /** Group for visual stacking */
  group: "site" | "edge" | "material" | "selection";
  /** Raw number for change detection / aria */
  numeric: number;
  unit: "m" | "m²" | "%";
};

function fmtM(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 100) return n.toFixed(0);
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

function fmtArea(n: number): string {
  return formatScheduleAreaM2(n);
}

function itemAreaM2(it: StudioItem): number {
  const d = BY_TYPE[it.t];
  if (d.canopyM || d.existing) {
    const canopy = (d.canopyM ?? 7) * (it.scale || 1);
    const r = canopy / 2;
    return Math.PI * r * r;
  }
  const foot = itemFootprintMetres({
    wPx: d.w,
    hPx: d.h,
    scale: it.scale || 1,
    areaKind: d.area === "ellipse" ? "ellipse" : d.area === "rect" ? "rect" : "none",
    linear: Boolean(d.lin),
  });
  return foot.area_m2;
}

function itemSizeLabel(it: StudioItem): { value: string; numeric: number; unit: "m" | "m²" } {
  const d = BY_TYPE[it.t];
  const foot = itemFootprintMetres({
    wPx: d.w,
    hPx: d.h,
    scale: it.scale || 1,
    areaKind: d.area === "ellipse" ? "ellipse" : d.area === "rect" ? "rect" : "none",
    linear: Boolean(d.lin),
  });
  if (d.lin) {
    return {
      value: `${fmtM(foot.perimeter_m)} m`,
      numeric: foot.perimeter_m,
      unit: "m",
    };
  }
  if (d.canopyM) {
    const canopy = d.canopyM * (it.scale || 1);
    return {
      value: `⌀ ${fmtM(canopy)} m`,
      numeric: canopy,
      unit: "m",
    };
  }
  return {
    value: `${fmtArea(foot.area_m2)} m²`,
    numeric: foot.area_m2,
    unit: "m²",
  };
}

const MATERIAL_ORDER: StudioItemType[] = [
  "paving",
  "deck",
  "lawn",
  "bed",
  "hedge",
  "frenchdrain",
  "canopy",
  "feature",
  "exist",
];

/**
 * Live measure ledger — recomputed whenever geometry / selection / scale changes.
 * Site rows use {@link resolveSiteAreaDisplay} so Fit Sheet / CAD / Sketch agree.
 */
export function buildLiveMeasures(args: {
  boundary: PctPoint[];
  building: PctPoint[];
  items: StudioItem[];
  scaleM: number;
  schedule: SiteSchedule | null;
  selected: StudioItem | null;
  cadastralLotM2?: number | null;
  cadastralHouseM2?: number | null;
}): LiveMeasureRow[] {
  const { boundary, building, items, scaleM, schedule, selected } = args;
  const rows: LiveMeasureRow[] = [];

  if (schedule) {
    const areas = resolveSiteAreaDisplay({
      schedule,
      cadastralLotM2: args.cadastralLotM2,
      cadastralHouseM2: args.cadastralHouseM2,
    });
    rows.push({
      id: "lot",
      label: "Lot",
      value: `${fmtArea(areas.lotAreaM2)} m²`,
      group: "site",
      numeric: areas.lotAreaM2,
      unit: "m²",
    });
    rows.push({
      id: "building",
      label: "Dwelling",
      value: `${fmtArea(areas.buildingAreaM2)} m²`,
      group: "site",
      numeric: areas.buildingAreaM2,
      unit: "m²",
    });
    rows.push({
      id: "outdoor",
      label: "Outdoor",
      value: `${fmtArea(areas.outdoorAreaM2)} m²`,
      group: "site",
      numeric: areas.outdoorAreaM2,
      unit: "m²",
    });
    rows.push({
      id: "perimeter",
      label: "Perimeter",
      value: `${fmtM(schedule.boundaryPerimeterM)} m`,
      group: "site",
      numeric: schedule.boundaryPerimeterM,
      unit: "m",
    });
    if (areas.siteCoveragePct > 0) {
      rows.push({
        id: "coverage",
        label: "Coverage",
        value: `${areas.siteCoveragePct.toFixed(0)}%`,
        group: "site",
        numeric: areas.siteCoveragePct,
        unit: "%",
      });
    }
  }

  if (boundary.length >= 2) {
    const segs: EdgeSegment[] = edgeSegments(boundary, "B", scaleM);
    for (const s of segs) {
      rows.push({
        id: `edge-${s.key}`,
        label: s.key,
        value: `${fmtM(s.lengthM)} m`,
        group: "edge",
        numeric: s.lengthM,
        unit: "m",
      });
    }
  }

  if (building.length >= 3) {
    const bPerim = polygonPerimeterM(building, scaleM);
    rows.push({
      id: "building-perim",
      label: "Envelope P",
      value: `${fmtM(bPerim)} m`,
      group: "edge",
      numeric: bPerim,
      unit: "m",
    });
    const fSegs = edgeSegments(building, "F", scaleM);
    for (const s of fSegs.slice(0, 6)) {
      rows.push({
        id: `edge-${s.key}`,
        label: s.key,
        value: `${fmtM(s.lengthM)} m`,
        group: "edge",
        numeric: s.lengthM,
        unit: "m",
      });
    }
  }

  const live = items.filter((i) => !i.ghost);
  const byType = new Map<StudioItemType, number>();
  for (const it of live) {
    byType.set(it.t, (byType.get(it.t) ?? 0) + itemAreaM2(it));
  }
  for (const t of MATERIAL_ORDER) {
    const area = byType.get(t);
    if (area == null || area <= 0.05) continue;
    const linear = Boolean(BY_TYPE[t].lin);
    rows.push({
      id: `mat-${t}`,
      label: BY_TYPE[t].tag,
      value: linear ? `${fmtM(area)} m` : `${fmtArea(area)} m²`,
      group: "material",
      numeric: area,
      unit: linear ? "m" : "m²",
    });
  }

  if (selected && !selected.ghost) {
    const size = itemSizeLabel(selected);
    rows.push({
      id: `sel-${selected.id}`,
      label: `Selected · ${BY_TYPE[selected.t].tag}`,
      value: size.value,
      group: "selection",
      numeric: size.numeric,
      unit: size.unit,
    });
  }

  return rows;
}
