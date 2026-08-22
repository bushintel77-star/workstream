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

function plantCodeBase(symbolId: string): string {
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
  return (fallback.slice(0, 2) || "PT").toUpperCase();
}

/**
 * One code per species, unique across the schedule.
 *
 * A schedule code identifies a species, not an instance — it used to be
 * suffixed with the placement index on the fallback branch, so the same species
 * could appear under several codes, and two species sharing initials could
 * collide on the botanical branch. Allocated over every placement (not the
 * density-sliced view) so codes do not change when the view compacts.
 */
function allocatePlantCodes(symbolIds: string[]): Map<string, string> {
  const used = new Set<string>();
  const out = new Map<string, string>();
  for (const symbolId of symbolIds) {
    if (out.has(symbolId)) continue;
    const base = plantCodeBase(symbolId);
    let code = base;
    let suffix = 2;
    while (used.has(code)) code = `${base}${suffix++}`;
    used.add(code);
    out.set(symbolId, code);
  }
  return out;
}

function detailId(index: number): string {
  return `D-${String(index + 1).padStart(2, "0")}`;
}

/** `bluestone-paver` → `Bluestone paver`. */
function humanize(value: string): string {
  const spaced = value.replace(/[-_]+/g, " ").trim();
  if (spaced === "") return "";
  return spaced[0]!.toUpperCase() + spaced.slice(1);
}

/**
 * The one survey edge-truth format, shared by the dimension ring chip and the
 * legend so the two can never drift. The bearing is omitted entirely when north
 * is uncalibrated rather than computed against board north.
 */
export function surveyEdgeLabel(
  key: string,
  bearing: string,
  distanceM: string,
): string {
  return bearing === ""
    ? `${key} \u00b7 ${distanceM} m`
    : `${key} \u00b7 ${bearing} \u00b7 ${distanceM} m`;
}

interface CalloutGroup {
  atPct: { x: number; y: number };
  text: string;
  count: number;
}

type KeyedCalloutGroup = CalloutGroup & { key: string };

/**
 * Collapse repeats into one callout each.
 *
 * Six boxes all reading `Intent: frame planting rhythm (…)` is what the old
 * per-placement derivation produced whenever a canvas had no material polygons,
 * and the 132 px box then ellipsis-truncated the plant code that was the only
 * difference between them. Grouping by species/material means one box per
 * distinct thing, front-loaded with the token that distinguishes it.
 */
function groupCallouts<T extends CalloutGroup>(groups: T[], limit: number): T[] {
  return [...groups]
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
    .slice(0, limit);
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
  // Edge keys match `edgeSegments(boundary, "B", …)` — the dimension ring is
  // what renders these, so the keys have to be the same ones it prints.
  const propertyLines = boundaryPct.map((from, idx) => {
    const to = boundaryPct[(idx + 1) % boundaryPct.length]!;
    const key = `B${idx + 1}`;
    const bearing = northCalibrated
      ? formatSurveyBearing(from, to, northBearingDeg)
      : "";
    const distanceM = fmt2(edgeLengthM(from, to, scaleM, boardAspect));
    return {
      id: `boundary-${idx + 1}`,
      key,
      fromPct: from,
      toPct: to,
      bearing,
      distanceM,
      label: surveyEdgeLabel(key, bearing, distanceM),
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

  const plantCodes = allocatePlantCodes(placements.map((p) => p.symbol_id));
  const plantTags = placements
    .slice(0, compact ? 14 : placements.length)
    .map((placement) => {
      const code = plantCodes.get(placement.symbol_id) ?? "PT";
      return {
        id: `plant-${placement.id}`,
        atPct: { x: placement.x_pct, y: placement.y_pct },
        code,
        scheduleLabel: `${code} \u2192 ${placement.symbol_id}`,
        symbolId: placement.symbol_id,
      };
    });

  const hatchPolygons = features.filter(
    (feature) =>
      feature.geometry.type === "Polygon" && feature.geometry.points.length >= 3,
  );
  const materialHatches = hatchPolygons.map((feature, idx) => {
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

  // One callout per distinct material and per distinct species, anchored at the
  // group centroid, ranked by how much of the design it speaks for.
  const groupsByKey = new Map<string, KeyedCalloutGroup>();
  const addToGroup = (
    key: string,
    text: string,
    at: { x: number; y: number },
  ) => {
    const existing = groupsByKey.get(key);
    if (existing) {
      existing.count += 1;
      existing.atPct = {
        x: existing.atPct.x + (at.x - existing.atPct.x) / existing.count,
        y: existing.atPct.y + (at.y - existing.atPct.y) / existing.count,
      };
      return;
    }
    groupsByKey.set(key, { key, text, atPct: at, count: 1 });
  };

  hatchPolygons.forEach((feature, idx) => {
    const hatch = materialHatches[idx]!;
    const sku = feature.material_fill?.sku ?? feature.metadata.friendly_name ?? "";
    const name = humanize(sku) || `${humanize(hatch.family)} surface`;
    addToGroup(`mat:${name}`, name, centroid(hatch.ringPct));
  });
  for (const tag of plantTags) {
    const botanical = getCatalogSymbol(tag.symbolId)?.botanical_name?.trim() ?? "";
    const name = botanical !== "" ? botanical : humanize(tag.symbolId);
    addToGroup(`plant:${tag.symbolId}`, `${tag.code} \u00b7 ${name}`, tag.atPct);
  }

  const callouts = groupCallouts(
    [...groupsByKey.values()],
    compact ? 4 : 8,
  ).map((group, idx) => ({
    // Keyed by group, not by position: the layout solver's hysteresis keys off
    // this id, so a positional id would make a callout inherit a neighbour's
    // slot whenever the ranking shifts.
    id: `callout-${group.key}`,
    detailId: detailId(idx),
    atPct: group.atPct,
    text: group.count > 1 ? `${group.text} \u00d7${group.count}` : group.text,
    count: group.count,
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
    {
      id: "callout",
      category: "detail_callout",
      group: "callouts",
      label: "Callout",
      value:
        callouts[0] != null
          ? `${callouts[0].detailId} ${callouts[0].text}`
          : "No detail callouts on this view",
    },
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
