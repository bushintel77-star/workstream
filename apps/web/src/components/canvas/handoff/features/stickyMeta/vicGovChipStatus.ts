/**
 * Vic-gov status chip derivation — v1 from already-hydrated canvas data.
 * Boundary / easements / KEYLESS / trees / BYDA / council chase — no new fetch.
 */

import type { DesignBydaAsset, DesignKeylessOverlay } from "@workstream/contracts";
import type { PctPoint } from "../../geometry";
import type { StudioItem } from "../../studioCatalog";
import { buildTreesLiveMeta } from "./treesLiveMeta";

export type VicGovChipId =
  | "boundary"
  | "easements"
  | "zoning"
  | "overlays"
  | "heritage"
  | "trees"
  | "byda"
  | "council"
  | "environment";

/** ok = clean/resolved · flag = conflict/attention · muted = unchecked/manual · warn = dig risk */
export type VicGovChipTone = "ok" | "flag" | "muted" | "warn";

export type VicGovChipPanel =
  | "site"
  | "services"
  | "trees"
  | "environment"
  | null;

export type VicGovChipModel = {
  id: VicGovChipId;
  label: string;
  face: string;
  tone: VicGovChipTone;
  panel: VicGovChipPanel;
  href?: string;
  /** When true, chip is omitted from the row (Heritage gated on HO). */
  hidden?: boolean;
};

export type VicGovChipInput = {
  boundary: PctPoint[];
  easements: PctPoint[][];
  keylessOverlays: DesignKeylessOverlay[];
  items: StudioItem[];
  bydaAssets: DesignBydaAsset[];
  boundarySource?: "vicmap" | "manual" | "seed" | null;
  titleSource?: string | null;
  councilLabel?: string | null;
  councilHref?: string | null;
  sitePackChase?: Array<{ id: string; done: boolean }>;
  envFace?: string | null;
  shadeOn?: boolean;
};

const OVERLAY_KINDS = new Set([
  "bushfire",
  "flood",
  "contour",
  "water_corp",
  "road_casement",
  "acid_sulfate",
  "wetland",
  "heritage",
]);

function shortOverlayLabel(kind: string, label?: string | null): string {
  if (kind === "bushfire") return "BMO";
  if (kind === "flood") return "LSIO";
  if (kind === "heritage") return "HO";
  if (kind === "water_corp") return "Water";
  if (kind === "road_casement") return "Road";
  if (kind === "acid_sulfate") return "ASS";
  if (kind === "wetland") return "Wetland";
  if (kind === "contour") return "Contour";
  return (label ?? kind).slice(0, 12);
}

function heritageHit(overlays: DesignKeylessOverlay[]): DesignKeylessOverlay | null {
  for (const o of overlays) {
    if (o.kind === "heritage") return o;
    const lab = (o.label ?? "").toLowerCase();
    if (/\bho\b/.test(lab) || lab.includes("heritage")) return o;
  }
  return null;
}

function bydaDigitised(assets: DesignBydaAsset[]): number {
  return assets.filter((a) => (a.ring?.length ?? 0) >= 2).length;
}

/** Build the ordered chip models for the Vic-gov status row. */
export function buildVicGovChipModels(input: VicGovChipInput): VicGovChipModel[] {
  const boundaryOk = input.boundary.length >= 3;
  const vicmap =
    input.boundarySource === "vicmap" ||
    /vicmap/i.test(input.titleSource ?? "");

  const easementN = input.easements.filter((r) => r.length >= 2).length;
  const planning = input.keylessOverlays.find((o) => o.kind === "planning");
  const overlayHits = input.keylessOverlays.filter((o) =>
    OVERLAY_KINDS.has(o.kind),
  );
  const ho = heritageHit(input.keylessOverlays);
  const trees = buildTreesLiveMeta({ items: input.items });
  const bydaN = bydaDigitised(input.bydaAssets);
  const bydaChaseDone = Boolean(
    input.sitePackChase?.find((c) => c.id === "byda")?.done,
  );

  const overlayFace =
    overlayHits.length === 0
      ? "None"
      : overlayHits
          .slice(0, 3)
          .map((o) => shortOverlayLabel(o.kind, o.label))
          .join(" · ");

  const councilName =
    (input.councilLabel ?? "")
      .replace(/^City of\s+/i, "")
      .trim()
      .slice(0, 14) || "Council";

  const chips: VicGovChipModel[] = [
    {
      id: "boundary",
      label: "Boundary",
      face: !boundaryOk
        ? "Missing"
        : vicmap
          ? "Vicmap"
          : "Traced",
      tone: !boundaryOk ? "muted" : vicmap ? "ok" : "flag",
      panel: "site",
    },
    {
      id: "easements",
      label: "Easements",
      face: easementN === 0 ? "Clean" : `${easementN} found`,
      tone: easementN === 0 ? (boundaryOk ? "ok" : "muted") : "flag",
      panel: "services",
    },
    {
      id: "zoning",
      label: "Zoning",
      face: planning?.label
        ? planning.label.slice(0, 16)
        : boundaryOk
          ? "Unchecked"
          : "—",
      tone: planning?.label ? "ok" : "muted",
      panel: "site",
    },
    {
      id: "overlays",
      label: "Overlays",
      face: overlayFace,
      tone:
        overlayHits.length === 0
          ? boundaryOk
            ? "ok"
            : "muted"
          : "flag",
      panel: "services",
    },
    {
      id: "heritage",
      label: "Heritage",
      face: ho?.label?.slice(0, 16) ?? "HO",
      tone: "flag",
      panel: "site",
      hidden: !ho,
    },
    {
      id: "trees",
      label: "Trees",
      face:
        trees.count === 0
          ? "None"
          : `${trees.count}${trees.tpzCount > 0 ? ` · ${trees.tpzCount} TPZ` : ""}`,
      tone: trees.count === 0 ? "muted" : trees.tpzCount > 0 ? "flag" : "ok",
      panel: "trees",
    },
    {
      id: "byda",
      label: "BYDA",
      face:
        bydaN > 0
          ? `${bydaN} assets`
          : bydaChaseDone
            ? "Filed"
            : "Confirm dig",
      tone: bydaN > 0 || bydaChaseDone ? "ok" : "warn",
      panel: "services",
      href: bydaN > 0 ? undefined : "https://www.byda.com.au/",
    },
    {
      id: "council",
      label: "Council",
      face: councilName,
      tone: boundaryOk ? "ok" : "muted",
      panel: "services",
      href: input.councilHref ?? "https://www.vic.gov.au/find-my-local-council",
    },
    {
      id: "environment",
      label: "Env",
      face: input.envFace?.slice(0, 18) || (input.shadeOn ? "Shade on" : "Sun"),
      tone: input.shadeOn ? "ok" : "muted",
      panel: "environment",
    },
  ];

  return chips.filter((c) => !c.hidden);
}
