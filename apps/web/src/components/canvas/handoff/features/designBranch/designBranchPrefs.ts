/**
 * Session preference for active design branch checkout.
 * Key: ws-design-branch:{projectId}
 */

const key = (projectId: string) => `ws-design-branch:${projectId}`;

export function readDesignBranchId(projectId: string): string | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    return sessionStorage.getItem(key(projectId));
  } catch {
    return null;
  }
}

export function writeDesignBranchId(
  projectId: string,
  branchId: string | null,
): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    if (!branchId) sessionStorage.removeItem(key(projectId));
    else sessionStorage.setItem(key(projectId), branchId);
  } catch {
    /* ignore quota */
  }
}

export function displayBranchName(name: string): string {
  if (name === "main") return "Main";
  return name;
}
