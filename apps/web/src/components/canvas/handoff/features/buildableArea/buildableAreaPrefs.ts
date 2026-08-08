/**
 * Session pin for buildable-area laser overlay.
 * Key: ws-buildable-area-pin:{projectId}
 */

const key = (projectId: string) => `ws-buildable-area-pin:${projectId}`;

export function readBuildableAreaPin(projectId: string): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    return sessionStorage.getItem(key(projectId)) === "1";
  } catch {
    return false;
  }
}

export function writeBuildableAreaPin(projectId: string, pinned: boolean): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    if (pinned) sessionStorage.setItem(key(projectId), "1");
    else sessionStorage.removeItem(key(projectId));
  } catch {
    /* ignore quota */
  }
}
