/**
 * Thin wrapper around the View Transitions API. Falls back to a direct
 * callback invocation when the API is unavailable or the user prefers
 * reduced motion.
 */
export function startViewTransition(
  update: () => void,
  options?: { enabled?: boolean },
): void {
  const enabled = options?.enabled ?? true;
  if (!enabled) {
    update();
    return;
  }

  const doc = document as Document & {
    startViewTransition?: (callback: () => void) => unknown;
  };

  if (typeof doc.startViewTransition === "function") {
    try {
      doc.startViewTransition(update);
      return;
    } catch {
      /* API present but rejected (e.g. nested call) — fall through */
    }
  }

  update();
}
