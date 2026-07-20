/**
 * Drawing-cursor marks — personalisation under settings.
 * Garden glyphs for Curtis & Co craft feel; not a tool inventory.
 */

export type PointerMarkId =
  | "spade"
  | "fork"
  | "trowel"
  | "hammer"
  | "shears"
  | "rake";

export type PointerMark = {
  id: PointerMarkId;
  label: string;
  glyph: string;
};

export const POINTER_MARKS: readonly PointerMark[] = [
  { id: "spade", label: "Spade", glyph: "♤" },
  { id: "fork", label: "Fork", glyph: "Ψ" },
  { id: "trowel", label: "Trowel", glyph: "▴" },
  { id: "hammer", label: "Hammer", glyph: "⚒" },
  { id: "shears", label: "Shears", glyph: "✂" },
  { id: "rake", label: "Rake", glyph: "☰" },
] as const;

const STORAGE_KEY = "ws-pointer-mark";
const DEFAULT_ID: PointerMarkId = "spade";

export function loadPointerMarkId(): PointerMarkId {
  if (typeof localStorage === "undefined") return DEFAULT_ID;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const legacy =
      raw ??
      (typeof localStorage !== "undefined"
        ? localStorage.getItem("ws-kit-hub-icon")
        : null);
    if (legacy && POINTER_MARKS.some((i) => i.id === legacy)) {
      return legacy as PointerMarkId;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_ID;
}

export function savePointerMarkId(id: PointerMarkId): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function pointerMarkById(id: PointerMarkId): PointerMark {
  return POINTER_MARKS.find((i) => i.id === id) ?? POINTER_MARKS[0]!;
}

/** CSS cursor from the chosen mark. */
export function pointerMarkCursor(id: PointerMarkId): string {
  const mark = pointerMarkById(id);
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">` +
      `<text x="16" y="21" text-anchor="middle" font-size="16" ` +
      `font-family="system-ui,sans-serif">${mark.glyph}</text></svg>`,
  );
  return `url("data:image/svg+xml,${svg}") 16 16, crosshair`;
}
