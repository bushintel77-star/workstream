/** Session prefs — sticky meta cards stay until the operator opts out. */

export type StickyMetaCardId =
  | "services"
  | "environment"
  | "site"
  | "trees";

const KEY = (projectId: string) => `ws-sticky-meta:${projectId || "demo"}`;

type Prefs = {
  dismissed: StickyMetaCardId[];
};

function read(projectId: string): Prefs {
  if (typeof window === "undefined") return { dismissed: [] };
  try {
    const raw = sessionStorage.getItem(KEY(projectId));
    if (!raw) return { dismissed: [] };
    const parsed = JSON.parse(raw) as Prefs;
    return {
      dismissed: Array.isArray(parsed.dismissed) ? parsed.dismissed : [],
    };
  } catch {
    return { dismissed: [] };
  }
}

function write(projectId: string, prefs: Prefs) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY(projectId), JSON.stringify(prefs));
  } catch {
    /* private mode */
  }
}

export function isStickyMetaDismissed(
  projectId: string,
  id: StickyMetaCardId,
): boolean {
  return read(projectId).dismissed.includes(id);
}

export function dismissStickyMeta(projectId: string, id: StickyMetaCardId) {
  const prefs = read(projectId);
  if (!prefs.dismissed.includes(id)) {
    prefs.dismissed = [...prefs.dismissed, id];
    write(projectId, prefs);
  }
}

export function restoreStickyMeta(projectId: string, id: StickyMetaCardId) {
  const prefs = read(projectId);
  prefs.dismissed = prefs.dismissed.filter((x) => x !== id);
  write(projectId, prefs);
}
