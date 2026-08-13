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
    startViewTransition?: (callback: () => void) => {
      finished?: Promise<unknown>;
      ready?: Promise<unknown>;
      updateCallbackDone?: Promise<unknown>;
    };
  };

  if (typeof doc.startViewTransition === "function") {
    try {
      const transition = doc.startViewTransition(update);
      // Chromium rejects `finished` when a newer transition supersedes this
      // one. It is a normal navigation race, not an application error.
      void transition.finished?.catch(() => undefined);
      return;
    } catch {
      /* API present but rejected (e.g. nested call) — fall through */
    }
  }

  update();
}
