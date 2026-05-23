/** Web Sentry hook — install `@sentry/nextjs` and set SENTRY_DSN to enable. */
export async function register() {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  console.warn(
    "[instrumentation] SENTRY_DSN is set; run pnpm add @sentry/nextjs in apps/web to activate.",
  );
}
