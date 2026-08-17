/**
 * Optional Sentry for the handheld (@sentry/react-native).
 *
 * Activates when `EXPO_PUBLIC_SENTRY_DSN` is set. Without it every call is a
 * no-op (errors still reach the console), so local/dev builds never depend on
 * Sentry. Initialised in app/_layout.tsx; capture helpers wired into the
 * field-capture screens' error paths.
 */
import * as Sentry from "@sentry/react-native";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? null;

let initialized = false;

/** Initialise Sentry (idempotent). Safe to call at app boot. */
export function initSentry(): void {
  if (initialized || !dsn) return;
  initialized = true;
  try {
    Sentry.init({
      dsn,
      environment: process.env.EXPO_PUBLIC_SENTRY_ENV ?? "production",
      tracesSampleRate: Number(
        process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.1,
      ),
    });
  } catch (err) {
    console.warn("[sentry] init failed", err);
  }
}

/**
 * Capture an error on the handheld. No-ops (console only) without a DSN.
 * `context.extra` is attached for the capture-screen error paths.
 */
export function captureMobileError(
  err: unknown,
  context?: Record<string, unknown>,
): void {
  if (!dsn) {
    console.error("[mobile]", context ?? {}, err);
    return;
  }
  try {
    if (!initialized) initSentry();
    Sentry.captureException(err, context ? { extra: context } : undefined);
  } catch {
    // Never let error reporting itself break the capture.
    console.error("[mobile]", context ?? {}, err);
  }
}
