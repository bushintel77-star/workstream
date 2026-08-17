/**
 * Web mirror of ./sentry.ts — @sentry/react-native has no web support and
 * pulls RN-only polyfills at bundle time, so the web build resolves this
 * platform file instead and never traverses the Sentry RN stack.
 *
 * Same exported API as the native module: every call is a console-only
 * no-op, which matches the native behaviour without a DSN anyway.
 * (The web preview renders WebPreviewHome and never exercises capture
 * paths; this exists so shared imports typecheck and bundle.)
 */

/** Initialise Sentry (idempotent). No-op on web. */
export function initSentry(): void {
  // No-op: Sentry telemetry is native-only (see ./sentry.ts).
}

/**
 * Capture an error on the handheld. On web, log to the console only.
 */
export function captureMobileError(
  err: unknown,
  context?: Record<string, unknown>,
): void {
  console.error("[mobile:web]", context ?? {}, err);
}
