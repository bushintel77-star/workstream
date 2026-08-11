import { SURVEY_TOOLS, type StudioMode, type StudioTool } from "../../studioCatalog";

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
  { id: "path", label: "Path", icon: "⌁", title: "Author a residential path" },
  { id: "measure", label: "Measure", icon: "⟋", title: "Measure" },
];

/** Shared chip list for ToolDock (desktop) and ContextualToolStrip (compact). */
export function buildToolChips(
  modeOrSurveyServices: StudioMode | boolean,
  surveyServicesArg = false,
): ToolChip[] {
  // Keep the one-argument helper contract for compact callers and tests while
  // allowing the rail components to request a mode-specific inventory.
  const mode =
    typeof modeOrSurveyServices === "boolean" ? "sketch" : modeOrSurveyServices;
  const surveyServicesAuthoring =
    typeof modeOrSurveyServices === "boolean"
      ? modeOrSurveyServices
      : surveyServicesArg;
  const allowedByMode: Record<StudioMode, ToolChipId[]> = {
    survey: ["trace", "select", "measure", "grid"],
    sketch: ["select", "add", "paint", "path", "zone", "measure", "grid"],
    cad: ["select", "add", "path", "zone", "measure", "grid"],
    elevation: ["select", "measure", "grid"],
    garden: ["select", "measure", "grid"],
    quote: ["select", "measure", "grid"],
    present: ["select", "grid"],
    share: ["select", "grid"],
  };
  const allowed = new Set(allowedByMode[mode]);
  const surveyExtras = surveyServicesAuthoring
    ? SURVEY_TOOLS.map((t) => ({
        id: t.id as StudioTool,
        label: t.label,
        icon: t.icon,
        title: t.title,
      }))
    : [];
  return [...PRIMARY, ...surveyExtras]
    .filter((chip) => {
      if (
        mode === "survey" &&
        surveyServicesAuthoring &&
        ["calib", "level", "service"].includes(chip.id)
      ) {
        return true;
      }
      return allowed.has(chip.id);
    })
    .map((chip) => (chip.id === "grid" ? { ...chip, trail: true } : chip));
}

export function toolChipActive(
  chip: ToolChip,
  args: { tool: StudioTool; locked: boolean; gridOn: boolean },
): boolean {
  if (chip.id === "grid") return args.gridOn;
  return args.tool === chip.id;
}

export function toolChipTestId(chip: ToolChip): string {
  return chip.id === "measure" ? "canvas-tool-measure" : `canvas-tool-${chip.id}`;
}
