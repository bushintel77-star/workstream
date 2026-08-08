/**
 * Session design schemes (A/B/C) under one title boundary.
 * Items + path corridors snapshot — site_frame (boundary/building/levels) shared.
 */

export type SchemeLetter = "A" | "B" | "C";

export type DesignScheme<TItem, TPath = never> = {
  id: string;
  letter: SchemeLetter;
  name: string;
  items: TItem[];
  pathCorridors: TPath[];
  savedAt: string;
};

export const SCHEME_LETTERS: SchemeLetter[] = ["A", "B", "C"];

export function schemeName(letter: SchemeLetter): string {
  return `Scheme ${letter}`;
}

export function nextSchemeLetter(
  existing: Array<{ letter: SchemeLetter }>,
): SchemeLetter | null {
  for (const letter of SCHEME_LETTERS) {
    if (!existing.some((s) => s.letter === letter)) return letter;
  }
  return null;
}

export function snapshotScheme<TItem, TPath = never>(
  letter: SchemeLetter,
  items: TItem[],
  pathCorridors: TPath[] = [],
  id = makeId(),
  now = new Date(),
): DesignScheme<TItem, TPath> {
  return {
    id,
    letter,
    name: schemeName(letter),
    items: items.map((it) => structuredClone(it)),
    pathCorridors: pathCorridors.map((p) => structuredClone(p)),
    savedAt: now.toISOString(),
  };
}

function makeId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `scheme-${Date.now()}`;
}
