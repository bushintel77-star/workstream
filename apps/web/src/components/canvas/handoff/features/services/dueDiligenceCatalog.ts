/**
 * Full landscape-architect pre-construction pack — status against Workstream.
 * Survey 5/5 is the digital minimum; this is the pack before excavation.
 */

export type DueDiligenceStatus =
  | "LIVE"
  | "KEYLESS"
  | "BYDA"
  | "COUNCIL"
  | "SURVEY"
  | "ARBOR"
  | "SITE"
  | "ENG"
  | "LINK"
  | "MANUAL";

export type DueDiligenceItem = {
  id: string;
  label: string;
  status: DueDiligenceStatus;
  group: "keyless" | "byda" | "chase";
};

/** KEYLESS next — same Vicmap/DELWP WFS stack as title. */
export const KEYLESS_NEXT: DueDiligenceItem[] = [
  { id: "k-planning", label: "Planning zone / overlays", status: "KEYLESS", group: "keyless" },
  { id: "k-bushfire", label: "Bushfire prone area", status: "KEYLESS", group: "keyless" },
  { id: "k-trees", label: "Urban trees / canopy", status: "KEYLESS", group: "keyless" },
  { id: "k-contours", label: "Contours", status: "KEYLESS", group: "keyless" },
  { id: "k-flood", label: "Flood history / LSIO", status: "KEYLESS", group: "keyless" },
  { id: "k-heritage", label: "Heritage overlay", status: "KEYLESS", group: "keyless" },
  { id: "k-watercorp", label: "Water corporation boundary", status: "KEYLESS", group: "keyless" },
  { id: "k-road", label: "Road casement", status: "KEYLESS", group: "keyless" },
  { id: "k-ass", label: "Acid sulfate soils", status: "KEYLESS", group: "keyless" },
  { id: "k-wetland", label: "Wetlands", status: "KEYLESS", group: "keyless" },
];

/** BYDA — membership enquiry, not keyless WFS. */
export const BYDA_PACK: DueDiligenceItem[] = [
  { id: "b-sewer", label: "Sewer main / house connection", status: "BYDA", group: "byda" },
  { id: "b-sw", label: "Stormwater assets", status: "BYDA", group: "byda" },
  { id: "b-water", label: "Water mains", status: "BYDA", group: "byda" },
  { id: "b-gas", label: "Gas", status: "BYDA", group: "byda" },
  { id: "b-power", label: "Power (UG)", status: "BYDA", group: "byda" },
  { id: "b-nbn", label: "NBN / telecom", status: "BYDA", group: "byda" },
  { id: "b-pits", label: "Pits / MH / valves", status: "BYDA", group: "byda" },
  { id: "b-depth", label: "Depth / diameter / owner", status: "BYDA", group: "byda" },
];

/** Must chase — council / survey / arbor / site. */
export const CHASE_PACK: DueDiligenceItem[] = [
  { id: "c-drain", label: "Council drainage register", status: "COUNCIL", group: "chase" },
  { id: "c-cot", label: "CoT / covenants / 173", status: "LINK", group: "chase" },
  { id: "c-boe", label: "Build over easement (BOE)", status: "COUNCIL", group: "chase" },
  { id: "c-lpod", label: "Legal point of discharge", status: "COUNCIL", group: "chase" },
  { id: "c-rl", label: "Measured RLs (feature survey)", status: "SURVEY", group: "chase" },
  { id: "c-ntpz", label: "Neighbour TPZs", status: "SITE", group: "chase" },
  { id: "c-srz", label: "Arborist SRZ", status: "ARBOR", group: "chase" },
  { id: "c-oh", label: "OH lines / aerial bundling", status: "SITE", group: "chase" },
  { id: "c-access", label: "Access / crossover", status: "SITE", group: "chase" },
  { id: "c-soil", label: "Soil / geotech", status: "ENG", group: "chase" },
  { id: "c-contam", label: "Contamination (Vic Unearthed)", status: "LINK", group: "chase" },
];

export const DUE_DILIGENCE_PACK: DueDiligenceItem[] = [
  ...KEYLESS_NEXT,
  ...BYDA_PACK,
  ...CHASE_PACK,
];
