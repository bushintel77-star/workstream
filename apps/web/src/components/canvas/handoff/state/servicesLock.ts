import type { StudioMode, StudioTool } from "../studioCatalog";

/** Survey-only tools that mutate site services / RL context. */
export const SURVEY_SERVICES_TOOLS: StudioTool[] = ["service", "level", "calib"];

/** Entering Quote or Share freezes survey services as site context. */
export function lockServicesOnMode(mode: StudioMode): boolean {
  return mode === "quote" || mode === "share";
}

export function surveyServicesAuthoringAllowed(args: {
  mode: StudioMode;
  servicesLocked: boolean;
}): boolean {
  return args.mode === "survey" && !args.servicesLocked;
}

export function servicesLayerOpacityEditable(servicesLocked: boolean): boolean {
  return !servicesLocked;
}

export function isSurveyServicesTool(tool: StudioTool): boolean {
  return (SURVEY_SERVICES_TOOLS as readonly string[]).includes(tool);
}
