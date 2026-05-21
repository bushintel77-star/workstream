/**
 * Runtime public config for Fly (secrets injected at container start).
 * NEXT_PUBLIC_* is optional when CLERK_PUBLISHABLE_KEY / API_URL are set.
 */
export function clerkPublishableKey(): string {
  return (
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??
    process.env.CLERK_PUBLISHABLE_KEY ??
    ""
  );
}

export function operatorApiUrl(): string {
  return (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:3001"
  );
}

export function portalBaseUrl(): string {
  return (
    process.env.PORTAL_BASE_URL ??
    process.env.NEXT_PUBLIC_PORTAL_BASE_URL ??
    "http://localhost:3002"
  );
}
