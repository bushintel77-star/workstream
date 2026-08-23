import type { CanvasMode } from "../../../lib/canvas-mode";

export type InteractionGuidance = {
  label: string;
  detail: string;
};

export function interactionGuidance(args: {
  activeMode: CanvasMode;
  sketchMode: boolean;
  measureActive: boolean;
  armedSymbolId: string | null;
  marqueeActive: boolean;
  trenchTool: string | null;
  zoneTool: string | null;
  splitView: boolean;
}): InteractionGuidance {
  if (args.armedSymbolId) {
    return { label: "Asset armed", detail: "Click the site to place it · Esc cancels" };
  }
  if (args.sketchMode) {
    return { label: "Sketch ink active", detail: "Drag on the site to draw · Esc cancels" };
  }
  if (args.measureActive) {
    return { label: "Measure active", detail: "Drag between two points · Esc cancels" };
  }
  if (args.marqueeActive) {
    return { label: "Marquee select active", detail: "Drag a box · Shift adds to selection · Esc cancels" };
  }
  if (args.trenchTool) {
    return {
      label: `${args.trenchTool.replaceAll("_", " ")} trace active`,
      detail: "Drag across the site to trace · Esc cancels",
    };
  }
  if (args.zoneTool) {
    return {
      label: `${args.zoneTool} zone active`,
      detail: "Drag across the site to trace · Esc cancels",
    };
  }
  if (args.splitView) {
    return {
      label: "Split view",
      detail: "Compare plan and 3D views with linked cameras",
    };
  }
  switch (args.activeMode) {
    case "survey":
      return { label: "Survey mode", detail: "Review site truth and constraints before designing" };
    case "sketch":
      return { label: "Sketch mode", detail: "Draw a concept or open Assets to place a symbol" };
    case "cad":
      return { label: "CAD mode", detail: "Refine geometry and review dimensions before pricing" };
    case "elevation":
      return { label: "Elevation mode", detail: "Inspect vertical relationships · Plan view is required for editing" };
    case "garden":
      return {
        label: "Garden mode",
        detail: "Explore at eye level — open Assets to place · click a plant to move or rotate · Wheel = zoom · Drag = pan",
      };
    case "quote":
      return { label: "Quote mode", detail: "Review what is included in the live estimate" };
    case "present":
      return { label: "Presentation mode", detail: "Prepare a client-facing view" };
    case "share":
      return { label: "Share mode", detail: "Review the client portal before publishing" };
  }
}
