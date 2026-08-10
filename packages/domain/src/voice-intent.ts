import type { VoiceIntentKind } from "@workstream/contracts";

const DESIGN_TERMS = /\b(add|create|draw|place|move|align|path|bed|plant|planting|paving|deck|lawn|hedge|tree|garden|north|south|east|west|setback|wide|metre|meter|m)\b/i;

export function classifyVoiceIntent(transcript: string): VoiceIntentKind {
  return DESIGN_TERMS.test(transcript) ? "design" : "dictation";
}
