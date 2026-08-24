/** Server-side helper — fetch without taking down the whole page.
 * Failures log a `[degraded]` line (label-tagged) so an API outage is
 * visible in ops output instead of rendering as "no data". */
export async function loadOptional<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<{ label: string; data: T | null; failed: boolean }> {
  try {
    return { label, data: await fn(), failed: false };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[degraded] ${label}: ${reason}`);
    return { label, data: null, failed: true };
  }
}
