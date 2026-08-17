/**
 * Optional Sentry for Next.js — client AND server.
 *
 * Activates when a DSN is present: `SENTRY_DSN` (server) or
 * `NEXT_PUBLIC_SENTRY_DSN` (client, inlined at build). Without a DSN every
 * call is a no-op (errors still reach the console), so local/dev builds never
 * depend on Sentry.
 *
 * Deliberately does NOT wrap next.config with `withSentryConfig` — that adds a
 * build-time source-map upload step that fails without a Sentry auth token.
 * Manual init + captureException keeps the build green; source-map upload can
 * be added later.
 */
import * as Sentry from "@sentry/nextjs";

const dsn =
  process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN ?? null;

let initialized = false;

/** Initialise Sentry (idempotent). Safe on client and server. */
export function initSentry(): void {
  if (initialized || !dsn) return;
  initialized = true;
  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? "production",
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
      // Client-only: capture unhandled rejections + window errors.
      ...(typeof window !== "undefined"
        ? { integrations: [Sentry.browserTracingIntegration()] }
        : {}),
    });
  } catch (err) {
    console.warn("[sentry] init failed", err);
  }
}

/**
 * Capture an error on either runtime. No-ops (console only) without a DSN.
 * `context.extra` is attached to the event for the studio error paths.
 */
export function captureWebError(
  err: unknown,
  context?: Record<string, unknown>,
): void {
  if (!dsn) {
    console.error("[web]", context ?? {}, err);
    return;
  }
  try {
    if (!initialized) initSentry();
    Sentry.captureException(err, context ? { extra: context } : undefined);
  } catch {
    // Never let error reporting itself break the app.
    console.error("[web]", context ?? {}, err);
  }
}
