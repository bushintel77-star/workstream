import type {
  CatalogPlacement,
  DesignSiteFrameLevel,
  LandscapeFeature,
} from "@workstream/contracts";
import { clampBoardPct } from "@workstream/contracts";
import { getCatalogSymbol } from "@workstream/domain";
import { edgeLengthM } from "../../handoff/geometry/polygon";
import type {
  AnnotationDialect,
  MaterialHatchFamily,
  SurveyedPlanLegendEntry,
  SurveyedPlanNotationModel,
} from "./model";
import { dialectStyleProfile } from "./style";

function toDms(angleDeg: number): { deg: number; min: number; sec: number } {
  const totalSeconds = Math.round(angleDeg * 3600);
  const deg = Math.floor(totalSeconds / 3600);
  const min = Math.floor((totalSeconds % 3600) / 60);
  const sec = totalSeconds % 60;
  return { deg, min, sec };
}

function fmt2(value: number): string {
  return value.toFixed(2);
}

export function formatSurveyBearing(
  fromPct: { x: number; y: number },
  toPct: { x: number; y: number },
  northBearingDeg?: number | null,
): string {
  const eastBoard = toPct.x - fromPct.x;
  const northBoard = -(toPct.y - fromPct.y);
  const theta = (((northBearingDeg ?? 0) % 360) + 360) % 360;
  const thetaRad = (theta * Math.PI) / 180;
  const dEast = eastBoard * Math.cos(thetaRad) + northBoard * Math.sin(thetaRad);
  const dNorth = -eastBoard * Math.sin(thetaRad) + northBoard * Math.cos(thetaRad);
  const ns = dNorth >= 0 ? "N" : "S";
  const ew = dEast >= 0 ? "E" : "W";
  const northAbs = Math.abs(dNorth);
  const eastAbs = Math.abs(dEast);
  const bearingTheta = northAbs < 1e-9 ? 90 : (Math.atan(eastAbs / northAbs) * 180) / Math.PI;
  const dms = toDms(bearingTheta);
  const deg = String(dms.deg).padStart(2, "0");
  const min = String(dms.min).padStart(2, "0");
  const sec = String(dms.sec).padStart(2, "0");
  return `${ns}${deg}\u00b0${min}'${sec}"${ew}`;
}

export function formatRl(value: number): string {
  const prefix = value >= 0 ? "+" : "-";
  return `${prefix}${Math.abs(value).toFixed(2)}`;
}

function centroid(points: Array<{ x: number; y: number }>): { x: number; y: number } {
  if (points.length === 0) return { x: 50, y: 50 };
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  return { x: x / points.length, y: y / points.length };
}

function materialFamily(feature: LandscapeFeature): MaterialHatchFamily {
  const sku = (feature.material_fill?.sku ?? feature.metadata.friendly_name ?? "").toLowerCase();
  if (/brick|masonry|clay/.test(sku)) return "brick";
  if (/stone|bluestone|granite/.test(sku)) return "stone";
  if (/gravel|aggregate|pebble/.test(sku)) return "gravel";
  return "concrete";
}

function plantCode(symbolId: string, idx: number): string {
  const catalog = getCatalogSymbol(symbolId);
  const botanical = catalog?.botanical_name?.trim() ?? "";
  if (botanical !== "") {
    const words = botanical.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
    }
    return words[0]!.slice(0, 2).toUpperCase();
  }
  const tokens = symbolId.split(/[-_]/).filter(Boolean);
  if (tokens.length >= 2) return `${tokens[0]![0]}${tokens[1]![0]}`.toUpperCase();
  const fallback = tokens[0] ?? symbolId;
  return (fallback.slice(0, 2) || "PT").toUpperCase() + String(idx + 1);
}

function detailId(index: number): string {
  return `D-${String(index + 1).padStart(2, "0")}`;
}

function buildLegend(entries: SurveyedPlanLegendEntry[]): SurveyedPlanLegendEntry[] {
  return entries.filter(
    (entry, idx) => entries.findIndex((item) => item.id === entry.id) === idx,
  );
}

export function deriveSurveyedPlanModel(params: {
  dialect: AnnotationDialect;
  boundaryPct: Array<{ x: number; y: number }>;
  scaleM: number;
  boardAspect: number;
  northBearingDeg?: number | null;
  levels: DesignSiteFrameLevel[];
  placements: CatalogPlacement[];
  features: LandscapeFeature[];
  density: "compact" | "full";
}): SurveyedPlanNotationModel {
  const {
    dialect,
    boundaryPct,
    scaleM,
    boardAspect,
    northBearingDeg,
    levels,
    placements,
    features,
    density,
  } = params;
  const northCalibrated =
    northBearingDeg != null &&
    Number.isFinite(northBearingDeg) &&
    northBearingDeg >= 0 &&
    northBearingDeg <= 360;
  const northLabel = northCalibrated
    ? `${northBearingDeg!.toFixed(1)}° true`
    : "Uncalibrated — locational-indicative";
  const styleProfile = dialectStyleProfile(dialect);
  const compact = density === "compact";
  const propertyLines = boundaryPct.map((from, idx) => {
    const to = boundaryPct[(idx + 1) % boundaryPct.length]!;
    const bearing = formatSurveyBearing(
      from,
      to,
      northCalibrated ? northBearingDeg : null,
    );
    const distanceM = fmt2(edgeLengthM(from, to, scaleM, boardAspect));
    return {
      id: `boundary-${idx + 1}`,
      fromPct: from,
      toPct: to,
      bearing,
      distanceM,
      label: `${bearing} ${distanceM} m`,
    };
  });

  const elevationMarks = levels
    .slice(0, compact ? 8 : levels.length)
    .map((level, idx) => ({
    id: `rl-${idx + 1}`,
    atPct: { x: level.x_pct, y: level.y_pct },
    rlText: formatRl(level.z_m),
    source:
      level.source === "authored" || level.source === "survey"
        ? ("proposed" as const)
        : ("existing" as const),
  }));

  const plantTags = placements
    .slice(0, compact ? 14 : placements.length)
    .map((placement, idx) => ({
    id: `plant-${placement.id}`,
    atPct: { x: placement.x_pct, y: placement.y_pct },
    code: plantCode(placement.symbol_id, idx),
    scheduleLabel: `${plantCode(placement.symbol_id, idx)} \u2192 ${placement.symbol_id}`,
    symbolId: placement.symbol_id,
  }));

  const materialHatches = features
    .filter((feature) => feature.geometry.type === "Polygon" && feature.geometry.points.length >= 3)
    .map((feature, idx) => {
      const ringPct = feature.geometry.points.map((point) => ({
        x: point.pct.x_pct,
        y: point.pct.y_pct,
      }));
      const family = materialFamily(feature);
      return {
        id: `hatch-${feature.id}`,
        family,
        ringPct,
        label: `${family[0]!.toUpperCase()}${family.slice(1)} hatch ${idx + 1}`,
      };
    });

  const calloutAnchors = [
    ...materialHatches.map((hatch) => centroid(hatch.ringPct)),
    ...plantTags.slice(0, compact ? 3 : 6).map((tag) => tag.atPct),
  ];
  const callouts = calloutAnchors.map((atPct, idx) => ({
    id: `callout-${idx + 1}`,
    detailId: detailId(idx),
    atPct,
    text:
      idx < materialHatches.length
        ? materialHatches[idx]!.label
        : dialect === "technical"
          ? `Plant schedule ${plantTags[idx - materialHatches.length]?.code ?? ""}`.trim()
          : `Intent: frame planting rhythm (${plantTags[idx - materialHatches.length]?.code ?? ""})`.trim(),
  }));

  const scopePoints = [
    ...placements.map((p) => ({ x: p.x_pct, y: p.y_pct })),
    ...features.flatMap((feature) =>
      feature.geometry.points.map((point) => ({
        x: point.pct.x_pct,
        y: point.pct.y_pct,
      })),
    ),
  ];
  let scopeOutlines: Array<{ id: string; ringPct: Array<{ x: number; y: number }>; label: string }> = [];
  if (scopePoints.length > 0) {
    const xs = scopePoints.map((p) => p.x);
    const ys = scopePoints.map((p) => p.y);
    const minX = clampBoardPct(Math.min(...xs) - 2);
    const maxX = clampBoardPct(Math.max(...xs) + 2);
    const minY = clampBoardPct(Math.min(...ys) - 2);
    const maxY = clampBoardPct(Math.max(...ys) + 2);
    scopeOutlines = [
      {
        id: "scope-main",
        ringPct: [
          { x: minX, y: minY },
          { x: maxX, y: minY },
          { x: maxX, y: maxY },
          { x: minX, y: maxY },
        ],
        label: "Contractor scope A",
      },
    ];
  }

  const legendEntries = buildLegend([
    {
      id: "boundary",
      category: "property_line",
      group: "boundaries",
      label: "Boundary",
      value: propertyLines[0]?.label ?? "No boundary segments available",
    },
    {
      id: "existing-rl",
      category: "elevation_rl",
      group: "levels",
      label: "RL existing",
      value:
        elevationMarks.find((mark) => mark.source === "existing")?.rlText != null
          ? `EX ${elevationMarks.find((mark) => mark.source === "existing")!.rlText}`
          : "No existing RL marks",
    },
    {
      id: "proposed-rl",
      category: "elevation_rl",
      group: "levels",
      label: "RL proposed",
      value:
        elevationMarks.find((mark) => mark.source === "proposed")?.rlText != null
          ? `PR ${elevationMarks.find((mark) => mark.source === "proposed")!.rlText}`
          : "No proposed RL marks",
    },
    {
      id: "plant-tags",
      category: "plant_tag",
      group: "plants",
      label: "Plant tags",
      value:
        plantTags[0] != null
          ? `${plantTags[0].code} → ${plantTags[0].symbolId}`
          : "No plant tags on this view",
    },
    { id: "hatch-brick", category: "material_hatch", group: "materials", label: "Brick hatch", value: "Diagonal + coursing ticks" },
    { id: "hatch-stone", category: "material_hatch", group: "materials", label: "Stone hatch", value: "Alternating diagonal set" },
    { id: "hatch-gravel", category: "material_hatch", group: "materials", label: "Gravel hatch", value: "Dot aggregate pattern" },
    { id: "hatch-concrete", category: "material_hatch", group: "materials", label: "Concrete hatch", value: "Sparse orthogonal hatch" },
    {
      id: "material-example",
      category: "material_hatch",
      group: "materials",
      label: "Active material",
      value:
        materialHatches[0] != null
          ? `${materialHatches[0].label} (${materialHatches[0].family})`
          : "No material hatch polygons",
    },
    { id: "callout", category: "detail_callout", group: "callouts", label: "Callout", value: "D-## detail key with leader" },
    { id: "scope", category: "scope_outline", group: "scope", label: "Scope", value: "Dashed contractor work extent" },
    {
      id: "north-calibration",
      category: "property_line",
      group: "conventions",
      label: "North frame",
      value: northLabel,
    },
    {
      id: "units",
      category: "property_line",
      group: "conventions",
      label: "Units",
      value: "Distance metres, RL to 0.01 m, bearings DMS",
    },
  ]);

  return {
    dialect,
    styleProfile,
    lineHierarchy: styleProfile.hierarchy,
    propertyLines,
    elevationMarks,
    plantTags,
    materialHatches,
    callouts,
    scopeOutlines,
    legendEntries,
  };
}
