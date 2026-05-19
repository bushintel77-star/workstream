import type { DesignGeneration } from "./tier1-types";

/** Detect the Prahran Tier-1 reference project from address text. */
export function isTier1WrightsTerrace(address: string): boolean {
  return /wrights?\s*t(er(race)?)?/i.test(address) && /prahran/i.test(address);
}

/** Savings ledger from Curtis Proposal v3 (36 Wrights Tce). */
export const TIER1_WRIGHTS_SAVINGS = {
  removed_ex: 3820.5,
  deployed_ex: 2860,
  net_ex: -960.5,
  net_inc_gst: -1191.96,
  target_total_inc_gst: 58410.35,
} as const;

export type Tier1DesignContext = {
  address: string;
  mode: string;
};

/** Tier-1 architectural massing — front entry + rear courtyard (proposal v3). */
export function tier1WrightsTerraceDesign(ctx: Tier1DesignContext): DesignGeneration {
  return {
    proposal: {
      zones: [
        {
          id: "front-entry",
          name: "Front entry",
          treatment:
            "Architecture locked under the lacework. 7 mm bluestone screenings ground plane, Cycas anchors against masonry, Ligularia monoblock, Buxus spheres, and a strict Ophiopogon Nana grid — no cottage scatter, no organic mulch.",
          plantings: [
            {
              species: "Cycas revoluta",
              common_name: "Sago palm",
              count: 2,
              form: "specimen",
              sku: "PLT-CYCAS-400",
            },
            {
              species: "Ligularia reniformis",
              common_name: "Tractor seat plant",
              count: 16,
              form: "mass",
              sku: "PLT-LIGULARIA-140",
            },
            {
              species: "Buxus microphylla",
              common_name: "Japanese box sphere",
              count: 4,
              form: "specimen",
              sku: "PLT-BUX-SPHERE-400",
            },
            {
              species: "Ophiopogon japonicus 'Nana'",
              common_name: "Dwarf mondo",
              count: 200,
              form: "groundcover",
              sku: "PLT-MONDO-NANA-50",
            },
          ],
          hardscape: [
            {
              item: "7 mm bluestone screenings",
              qty: 4,
              unit: "m³",
              sku: "SCREEN-BLUE-7MM",
            },
          ],
          lighting: [],
          irrigation: [
            { item: "Drip line", qty: 45, unit: "lm", sku: "IRR-DRIP" },
            {
              item: "4-station irrigation controller (front + rear)",
              qty: 1,
              unit: "ea",
              sku: "IRR-CTRL-4",
            },
            {
              item: "Irrigation zone install",
              qty: 1,
              unit: "zone",
              sku: "TSK-IRR-ZONE",
            },
          ],
        },
        {
          id: "rear-courtyard",
          name: "Rear courtyard",
          treatment:
            "Conservatory edge. Boston ivy dissolving the charcoal brick boundary, Rojo Congo against green render, bluestone screenings, and concealed deck-reveal strip lighting at dusk.",
          plantings: [
            {
              species: "Parthenocissus tricuspidata",
              common_name: "Boston ivy",
              count: 12,
              form: "climber",
              sku: "PLT-BOSTON-IVY",
            },
            {
              species: "Philodendron 'Rojo Congo'",
              common_name: "Rojo Congo",
              count: 10,
              form: "mass",
              sku: "PLT-ROJO-CONGO-200",
            },
          ],
          hardscape: [
            {
              item: "7 mm bluestone screenings",
              qty: 2,
              unit: "m³",
              sku: "SCREEN-BLUE-7MM",
            },
          ],
          lighting: [
            {
              fixture: "Concealed deck strip (IP67)",
              count: 12,
              sku: "LGT-DECK-STRIP",
            },
            { fixture: "LV transformer", count: 1, sku: "LGT-TX-150" },
          ],
          irrigation: [],
        },
      ],
      estimated_complexity: "complex",
    },
    gaps: [
      {
        zone: "front-entry",
        description: "Luma drawings are concept only — confirm step nosing detail on site walk.",
        proposed_fill: "Separate riser stone or 60 mm nose course (variation V1).",
        rationale: "Mitred 30 mm paver nosing chips within 12 months on entry traffic.",
      },
    ],
    rationale:
      "Tier-1 architectural massing for 36 Wrights Terrace: singular species in disciplined blocks, permanent bluestone ground plane (zero re-mulch over five years), and one irrigation controller serving both zones. Capital reclaimed from cottage perennials and a redundant rear irrigation zone, reinvested into anchors, structure, and deck-reveal lighting.",
  };
}
