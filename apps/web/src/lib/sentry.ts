/**
 * Optional Sentry for Next.js. Activates when SENTRY_DSN is set at runtime.
 * No @sentry/nextjs install required until DSN is configured in production.
 */

type SentryModule = {
  init: (options: { dsn: string; environment: string; tracesSampleRate: number }) => void;
  captureException: (err: unknown, options?: { extra?: Record<string, unknown> }) => void;
};

let sentryReady = false;

/**
 * Load @sentry/nextjs without the bundler resolving it at compile time.
 * `import("@sentry/nextjs" as string)` still lets Turbopack/webpack see the
 * specifier and fail the build when the package is absent. Building the path
 * from a variable defeats static resolution, so production builds succeed
 * without @sentry/nextjs installed; the .catch handles the runtime absence.
 */
async function loadSentry(): Promise<SentryModule | null> {
  const moduleName = "@sentry/nextjs";
  try {
    const mod = (await import(moduleName as string).catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!mod || typeof mod.init !== "function") return null;
    return mod as unknown as SentryModule;
  } catch {
    return null;
  }
}

export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || typeof window !== "undefined") return;
  try {
    const Sentry = await loadSentry();
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
      const Sentry = await loadSentry();
      Sentry?.captureException(err, { extra: context });
    } catch {
      /* swallow */
    }
  })();
}
