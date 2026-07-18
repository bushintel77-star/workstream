import type { CatalogPlacement } from "@workstream/contracts";

/**
 * Minimal starter massing so first-run can unlock CAD + live BOM
 * without asking the operator to invent a layout.
 */
export function buildFirstRunSeedPlacements(
  idFactory: () => string = () => crypto.randomUUID(),
): CatalogPlacement[] {
  return [
    {
      id: idFactory(),
      symbol_id: "lawn-turf",
      x_pct: 52,
      y_pct: 58,
      rotation_deg: 0,
      scale: 1.2,
      label: "Lawn (starter)",
    },
    {
      id: idFactory(),
      symbol_id: "bluestone-paver",
      x_pct: 42,
      y_pct: 48,
      rotation_deg: 0,
      scale: 1,
      label: "Paving (starter)",
    },
    {
      id: idFactory(),
      symbol_id: "existing-tree-retain",
      x_pct: 68,
      y_pct: 36,
      rotation_deg: 0,
      scale: 1,
      label: "Retain tree",
    },
  ];
}
