/**
 * Fit sheet session prefs — restore paper working-drawing toggles per project.
 * Keys: ws-fit-sheet:{id}, ws-fit-dims:{id} (see AGENTS.md).
 */

export type FitSheetPrefs = {
  frameOn: boolean;
  sheetElevOn: boolean;
};

export function loadFitSheetPrefs(projectId: string): Partial<FitSheetPrefs> | null {
  if (typeof window === "undefined") return null;
  try {
    const frameRaw = sessionStorage.getItem(`ws-fit-sheet:${projectId}`);
    const dimsRaw = sessionStorage.getItem(`ws-fit-dims:${projectId}`);
    const out: Partial<FitSheetPrefs> = {};
    if (frameRaw === "1") out.frameOn = true;
    if (frameRaw === "0") out.frameOn = false;
    if (dimsRaw === "1") out.sheetElevOn = true;
    if (dimsRaw === "0") out.sheetElevOn = false;
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

export function saveFitSheetPrefs(
  projectId: string,
  prefs: FitSheetPrefs,
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      `ws-fit-sheet:${projectId}`,
      prefs.frameOn ? "1" : "0",
    );
    sessionStorage.setItem(
      `ws-fit-dims:${projectId}`,
      prefs.sheetElevOn ? "1" : "0",
    );
  } catch {
    /* quota / private mode */
  }
}
