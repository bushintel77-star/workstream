/**
 * Runtime public config (secrets injected at container start on Railway).
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

/** Fail fast in production if the web container still points at localhost. */
export function assertProductionPublicEnv(): void {
  if (process.env.NODE_ENV !== "production") return;
  /* `next build` sets NODE_ENV=production before Railway injects runtime env. */
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const api = operatorApiUrl();
  if (!api || /localhost|127\.0\.0\.1/i.test(api)) {
    throw new Error(
      "API_URL / NEXT_PUBLIC_API_URL must point at the production API (not localhost)",
    );
  }
  /* Checkout success/cancel URLs are built from this base — a localhost
   * default here would strand a paying customer after Stripe checkout. */
  const webBase =
    process.env.NEXT_PUBLIC_WEB_URL ??
    process.env.PORTAL_BASE_URL ??
    "http://localhost:3002";
  if (/localhost|127\.0\.0\.1/i.test(webBase)) {
    throw new Error(
      "NEXT_PUBLIC_WEB_URL / PORTAL_BASE_URL must point at the production web app for checkout redirects (not localhost)",
    );
  }
}
