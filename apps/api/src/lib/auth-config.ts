/** True when Clerk must be configured (no dev-user fallback). */
export function isAuthRequired(): boolean {
  if (process.env.AUTH_REQUIRED === "true") return true;
  if (process.env.AUTH_REQUIRED === "false") return false;
  return process.env.NODE_ENV === "production";
}

export function assertAuthConfigured(): void {
  if (isAuthRequired() && !process.env.CLERK_SECRET_KEY) {
    throw new Error(
      "CLERK_SECRET_KEY is required in production. Set AUTH_REQUIRED=false only for local demos.",
    );
  }
}
