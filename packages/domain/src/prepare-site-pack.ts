/**
 * Prepare site pack — agentic-lite job intake (P0 title → P1 washes → P2 trees).
 * Chase list covers non-GIS items (CoT, BYDA, council drain, arbor).
 */

export type SitePackChaseId = "cot" | "byda" | "council_drain" | "arbor";

export type SitePackChaseItem = {
  id: SitePackChaseId;
  label: string;
  done: boolean;
  href?: string;
};

export type PrepareSitePackTipInput = {
  titleOk: boolean;
  overlayCount: number;
  treeGhostCount: number;
  chasePending: number;
};

/** Operator tip after Prepare site pack runs (Cmd+K). */
export function prepareSitePackTip(input: PrepareSitePackTipInput): string {
  const parts: string[] = ["Site pack"];
  if (input.titleOk) {
    parts.push("Title + dwelling snapped");
  } else {
    parts.push("Title hydrate failed — check pin / survey");
  }
  if (input.overlayCount > 0) {
    parts.push(`${input.overlayCount} KEYLESS wash${input.overlayCount === 1 ? "" : "es"}`);
  } else {
    parts.push("KEYLESS washes empty — retry overlays");
  }
  if (input.treeGhostCount > 0) {
    parts.push(
      `Review ${input.treeGhostCount} exist tree ghost${input.treeGhostCount === 1 ? "" : "s"} — measure DBH on site for TPZ`,
    );
  } else {
    parts.push("No Vicmap trees — place exist on site walk");
  }
  if (input.chasePending > 0) {
    parts.push(`${input.chasePending} chase item${input.chasePending === 1 ? "" : "s"} open`);
  } else {
    parts.push("Chase list clear");
  }
  return parts.join(" · ");
}

export type CouncilDrainageChase = {
  label: string;
  href: string;
  requestTemplate: string;
};

/** LGA → council drainage enquiry deep-link + request template. */
export function councilDrainageChase(
  lgaCode: string | null | undefined,
  councilLabel: string | null | undefined,
): CouncilDrainageChase {
  const code = (lgaCode ?? "").trim();
  const name = (councilLabel ?? "your council").trim() || "your council";
  // Stonnington / Yarra known engineering portals; else generic Vic councils directory.
  if (code === "363" || /stonnington/i.test(name)) {
    return {
      label: "City of Stonnington — drainage / engineering",
      href: "https://www.stonnington.vic.gov.au/About/Contact-us",
      requestTemplate:
        "Request: legal point of discharge + council drain plans for [SPI/address]. Landscape construction — not title easement only.",
    };
  }
  if (code === "372" || code === "373" || /yarra/i.test(name)) {
    return {
      label: "City of Yarra — asset / drainage enquiry",
      href: "https://www.yarracity.vic.gov.au/contact-us",
      requestTemplate:
        "Request: stormwater assets + PoD for [SPI/address]. Confirm rear / nature-strip drains before dig.",
    };
  }
  return {
    label: `${name} — drainage / engineering enquiry`,
    href: "https://www.vic.gov.au/find-my-local-council",
    requestTemplate:
      "Request: legal point of discharge + council drainage plans for [SPI/address]. Vicmap easements are incomplete — confirm council assets before dig.",
  };
}

/** Default chase list for a new Prepare site pack run. */
export function defaultSitePackChase(args: {
  lgaCode?: string | null;
  councilLabel?: string | null;
}): SitePackChaseItem[] {
  const drain = councilDrainageChase(args.lgaCode, args.councilLabel);
  return [
    {
      id: "cot",
      label: "Certificate of Title + plan (Landata ≤28 days)",
      done: false,
      href: "https://www.land.vic.gov.au/landata",
    },
    {
      id: "byda",
      label: "Lodge BYDA + upload plans to project (dig gate)",
      done: false,
      href: "https://www.byda.com.au/",
    },
    {
      id: "council_drain",
      label: drain.label,
      done: false,
      href: drain.href,
    },
    {
      id: "arbor",
      label: "Arborist / measured DBH for retained trees (AS 4970 TPZ)",
      done: false,
    },
  ];
}

/**
 * Dig tools unlock when ≥1 BYDA asset is on the frame, or operator override stamped.
 */
export function digToolsUnlocked(args: {
  bydaAssetCount: number;
  digOverrideAt?: string | null;
}): boolean {
  if (args.bydaAssetCount > 0) return true;
  if (args.digOverrideAt && args.digOverrideAt.trim()) return true;
  return false;
}

export const PREPARE_SITE_PACK_QUERY =
  "prepare site pack — Vicmap title, KEYLESS washes, urban trees, chase list";
