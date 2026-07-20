/**
 * Personalisable kit-hub marks — garden tools, not game loot icons.
 * Hover the hub to skim; click to keep (persisted per browser).
 */

export type KitHubIconId =
  | "spade"
  | "fork"
  | "trowel"
  | "hammer"
  | "shears"
  | "rake";

export type KitHubIcon = {
  id: KitHubIconId;
  label: string;
  /** Simple geometric mark — reads at 20–28px on slate glass. */
  glyph: string;
};

export const KIT_HUB_ICONS: readonly KitHubIcon[] = [
  { id: "spade", label: "Spade", glyph: "♤" },
  { id: "fork", label: "Fork", glyph: "Ψ" },
  { id: "trowel", label: "Trowel", glyph: "▴" },
  { id: "hammer", label: "Hammer", glyph: "⚒" },
  { id: "shears", label: "Shears", glyph: "✂" },
  { id: "rake", label: "Rake", glyph: "☰" },
] as const;

const STORAGE_KEY = "ws-kit-hub-icon";
const DEFAULT_ID: KitHubIconId = "spade";

export function loadKitHubIconId(): KitHubIconId {
  if (typeof localStorage === "undefined") return DEFAULT_ID;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && KIT_HUB_ICONS.some((i) => i.id === raw)) {
      return raw as KitHubIconId;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_ID;
}

export function saveKitHubIconId(id: KitHubIconId): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function kitHubIconById(id: KitHubIconId): KitHubIcon {
  return KIT_HUB_ICONS.find((i) => i.id === id) ?? KIT_HUB_ICONS[0]!;
}
