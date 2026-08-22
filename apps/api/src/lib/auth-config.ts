/**
 * True when Clerk must be configured (no dev-user fallback).
 *
 * Production is always fail-closed: the shared `dev-user` bypass is a local
 * development convenience only, and `AUTH_REQUIRED=false` must not be able to
 * open a production deployment. Outside production the explicit flag wins.
 */
export function isAuthRequired(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  if (process.env.AUTH_REQUIRED === "true") return true;
  if (process.env.AUTH_REQUIRED === "false") return false;
  return false;
}

export function assertAuthConfigured(): void {
  if (isAuthRequired() && !process.env.CLERK_SECRET_KEY) {
    throw new Error(
      "CLERK_SECRET_KEY is required in production. Set AUTH_REQUIRED=false only for local demos.",
    );
  }
}
