/**
 * Optional Sentry for Next.js. Activates when SENTRY_DSN is set at runtime.
 * No @sentry/nextjs install required until DSN is configured in production.
 */

type SentryModule = {
  init: (options: { dsn: string; environment: string; tracesSampleRate: number }) => void;
  captureException: (err: unknown, options?: { extra?: Record<string, unknown> }) => void;
};

let sentryReady = false;

async function safeLoadSentry(): Promise<SentryModule | null> {
  if (typeof window !== "undefined") return null;

  try {
    const dynamicImport = new Function(
      "return import('@sentry/nextjs')",
    ) as () => Promise<SentryModule>;
    return await dynamicImport().catch(() => null);
  } catch {
    return null;
  }
}

export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || typeof window !== "undefined") return;
  try {
    const Sentry = await safeLoadSentry();
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
  console.error("[web]", context ?? {}, err);
  void (async () => {
    try {
      if (!sentryReady) await initSentry();
      if (!sentryReady) return;
      const Sentry = await safeLoadSentry();
      Sentry?.captureException(err, { extra: context });
    } catch {
      /* swallow */
    }
  })();
}
