export type ToolOverride =
  | "place"
  | "draw"
  | "select"
  | "measure"
  | "massplant"
  | "irrigation"
  | "pan"
  | null;

export type StudioShellLayout = "legacy" | "desktop";

export type RailTab =
  | "ai"
  | "inspector"
  | "layers"
  | "library"
  | "massplant"
  | "irrigation"
  | "schedule";

export type RightRailTab = "inspector" | "layers" | "library" | "schedule" | "ai";
