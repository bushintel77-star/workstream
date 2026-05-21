/**
 * Minimal Sentry scaffold. Activates only if SENTRY_DSN is set so dev
 * doesn't ship telemetry. To enable in prod:
 *
 *   1. Sign up at sentry.io, create a Node.js project, copy the DSN.
 *   2. `pnpm --filter @workstream/api add @sentry/node`
 *   3. `flyctl secrets set SENTRY_DSN=… -a construct-api`
 *   4. Redeploy.
 *
 * The dynamic import keeps @sentry/node out of the bundle when DSN is
 * unset — no install, no overhead.
 */

let sentryReady = false;

export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Sentry: any = await import(
      /* webpackIgnore: true */
      "@sentry/node" as string
    ).catch(() => null);
    if (!Sentry?.init) {
      console.warn(
        "[sentry] @sentry/node not installed; skipping (install it to enable)",
      );
      return;
    }
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? "production",
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
      release: process.env.FLY_MACHINE_VERSION,
    });
    sentryReady = true;
  } catch (err) {
    console.warn("[sentry] init failed", err);
  }
}

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (!sentryReady) return;
  void (async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Sentry: any = await import("@sentry/node" as string).catch(
        () => null,
      );
      Sentry?.captureException?.(err, { extra: context });
    } catch {
      /* swallow */
    }
  })();
}
