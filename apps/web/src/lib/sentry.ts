/**
 * Optional Sentry for Next.js. Activates when SENTRY_DSN is set at runtime.
 * No @sentry/nextjs install required until DSN is configured in production.
 */

let sentryReady = false;

export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || typeof window !== "undefined") return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Sentry: any = await import("@sentry/nextjs" as string).catch(() => null);
    if (!Sentry?.init) {
      console.warn("[sentry] @sentry/nextjs not installed; skipping");
      return;
    }
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? "production",
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    });
    sentryReady = true;
  } catch (err) {
    console.warn("[sentry] web init failed", err);
  }
}

export function captureWebError(
  err: unknown,
  context?: Record<string, unknown>,
): void {
  if (!sentryReady) return;
  void (async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Sentry: any = await import("@sentry/nextjs" as string).catch(
        () => null,
      );
      Sentry?.captureException?.(err, { extra: context });
    } catch {
      /* swallow */
    }
  })();
}
