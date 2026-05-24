/** Server-side helper — fetch without taking down the whole page. */
export async function loadOptional<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<{ label: string; data: T | null; failed: boolean }> {
  try {
    return { label, data: await fn(), failed: false };
  } catch {
    return { label, data: null, failed: true };
  }
}
