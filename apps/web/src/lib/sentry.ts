/**
 * Optional Sentry for Next.js. Activates when SENTRY_DSN is set at runtime.
 * No @sentry/nextjs install required until DSN is configured in production.
 */

type SentryModule = {
  init: (options: { dsn: string; environment: string; tracesSampleRate: number }) => void;
  captureException: (err: unknown, options?: { extra?: Record<string, unknown> }) => void;
};

let sentryReady = false;

export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || typeof window !== "undefined") return;
  try {
    // "as string" keeps the dynamic import typed as Promise<any> so the
    // optional dependency does not need to be installed for typecheck.
    const Sentry = (await import("@sentry/nextjs" as string).catch(
      () => null,
    )) as SentryModule | null;
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
      const Sentry = (await import("@sentry/nextjs" as string).catch(
        () => null,
      )) as SentryModule | null;
      Sentry?.captureException(err, { extra: context });
    } catch {
      /* swallow */
    }
  })();
}
