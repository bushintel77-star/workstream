/** Boot hooks — production env gate + optional Sentry. */
export async function register() {
  const { assertProductionPublicEnv } = await import("./lib/public-env");
  assertProductionPublicEnv();

  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  const { initSentry } = await import("./lib/sentry");
  await initSentry();
}
