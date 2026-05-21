/**
 * Workstream env names (replaces legacy CONSTRUCT_*). Reads new names first,
 * falls back to CONSTRUCT_* so existing Fly secrets keep working until rotated.
 */
export function portalSecret(): string | undefined {
  return (
    process.env.WORKSTREAM_PORTAL_SECRET ??
    process.env.CONSTRUCT_PORTAL_SECRET
  );
}

export function persistPathOverride(): string | undefined {
  return (
    process.env.WORKSTREAM_PERSIST_PATH ?? process.env.CONSTRUCT_PERSIST_PATH
  );
}

export const FLY_API_APP = "workstream-api";
export const FLY_WEB_APP = "workstream-web";
export const FLY_API_HOST = "https://workstream-api.fly.dev";
export const FLY_WEB_HOST = "https://workstream-web.fly.dev";

/** Legacy Fly apps — still valid until you cut over DNS/deploy targets. */
export const LEGACY_FLY_API_HOST = "https://construct-api.fly.dev";
export const LEGACY_FLY_WEB_HOST = "https://construct-web.fly.dev";
