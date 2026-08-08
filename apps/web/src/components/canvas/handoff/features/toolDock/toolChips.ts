import { SURVEY_TOOLS, type StudioTool } from "../../studioCatalog";

export type ToolChipId = StudioTool | "measure" | "grid";

export type ToolChip = {
  id: ToolChipId;
  label: string;
  icon: string;
  title?: string;
  trail?: boolean;
};

const PRIMARY: ToolChip[] = [
  { id: "trace", label: "Trace", icon: "✎", title: "Trace boundary or building" },
  {
    id: "select",
    label: "Select",
    icon: "➤",
    title: "Select — grab, marquee, edit nodes (Esc)",
  },
  { id: "add", label: "Add", icon: "+", title: "Place from inventory" },
  {
    id: "paint",
    label: "Paint",
    icon: "▣",
    title: "Fill swatch — click a shape",
  },
  {
    id: "zone",
    label: "Zone",
    icon: "〰",
    title: "Drip or lighting path",
  },
  { id: "measure", label: "Measure", icon: "⟋", title: "Measure" },
  { id: "lock", label: "Lock", icon: "⬡", title: "Lock selection" },
];

/** Shared chip list for ToolDock (desktop) and ContextualToolStrip (compact). */
export function buildToolChips(surveyServicesAuthoring: boolean): ToolChip[] {
  const surveyExtras = surveyServicesAuthoring
    ? SURVEY_TOOLS.map((t) => ({
        id: t.id as StudioTool,
        label: t.label,
        icon: t.icon,
        title: t.title,
      }))
    : [];
  return [
    ...PRIMARY,
    ...surveyExtras,
    { id: "grid", label: "Grid", icon: "▦", title: "Drafting grid", trail: true },
  ];
}

export function toolChipActive(
  chip: ToolChip,
  args: { tool: StudioTool; locked: boolean; gridOn: boolean },
): boolean {
  if (chip.id === "grid") return args.gridOn;
  if (chip.id === "lock") return args.locked && args.tool === "lock";
  return args.tool === chip.id;
}

export function toolChipTestId(chip: ToolChip): string {
  return chip.id === "measure" ? "canvas-tool-measure" : `canvas-tool-${chip.id}`;
}
