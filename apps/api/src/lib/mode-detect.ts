import type { DesignMode } from "@workstream/contracts";

const COVERAGE_TERMS = [
  ["front", "frontage", "street", "verge"],
  ["back", "rear", "behind"],
  ["pav", "stone", "concrete", "deck", "terrace", "patio"],
  ["light"],
  ["irrigat", "drip"],
  ["hedge", "screen", "pleach"],
  ["lawn", "turf", "grass"],
  ["tree", "trees"],
  ["mass", "planting", "underst"],
];

export function detectMode(transcript: string | null | undefined): {
  mode: DesignMode;
  coverage: number;
  word_count: number;
} {
  if (!transcript || transcript.trim().length === 0) {
    return { mode: "auto", coverage: 0, word_count: 0 };
  }

  const text = transcript.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const covered = COVERAGE_TERMS.filter((group) =>
    group.some((term) => text.includes(term)),
  ).length;
  const coverage = covered / COVERAGE_TERMS.length;

  if (words.length < 25 || coverage < 0.2) {
    return { mode: "auto", coverage, word_count: words.length };
  }
  if (coverage >= 0.7 && words.length >= 80) {
    return { mode: "validate", coverage, word_count: words.length };
  }
  return { mode: "gapfill", coverage, word_count: words.length };
}
