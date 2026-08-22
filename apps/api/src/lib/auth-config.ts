/**
 * True when Clerk must be configured (no dev-user fallback).
 *
 * Unset AUTH_REQUIRED in production is fail-closed (Clerk required). An
 * explicit AUTH_REQUIRED=false is the bootstrap override used on Railway
 * until Clerk keys are provisioned. AUTH_REQUIRED=true always requires Clerk.
 */
export function isAuthRequired(): boolean {
  const flag = process.env.AUTH_REQUIRED;
  if (flag === "false") return false;
  if (flag === "true") return true;
  return process.env.NODE_ENV === "production";
}

export function assertAuthConfigured(): void {
  if (isAuthRequired() && !process.env.CLERK_SECRET_KEY) {
    throw new Error(
      "CLERK_SECRET_KEY is required when auth is required. Set AUTH_REQUIRED=false to boot without Clerk (demo/bootstrap only).",
    );
  }
}
