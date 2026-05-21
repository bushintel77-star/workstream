import type { WorkspacePlan } from "@workstream/contracts";

/** Solo operator — full pipeline, dev fallbacks for live connectors. */
export const LITE_SEAT_LIMIT = 1;

/** Keys that only perform live external calls on Studio plan. */
export const STUDIO_LIVE_INTEGRATION_KEYS = new Set([
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "MAPBOX_TOKEN",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "MYOB_ACCESS_TOKEN",
  "MYOB_COMPANY_FILE_ID",
  "XERO_ACCESS_TOKEN",
  "XERO_TENANT_ID",
  "RESEND_API_KEY",
  "CRM_WEBHOOK_URL",
]);

export function isStudioLiveKey(key: string): boolean {
  return STUDIO_LIVE_INTEGRATION_KEYS.has(key);
}

export function canUseLiveIntegration(plan: WorkspacePlan, key: string): boolean {
  if (!isStudioLiveKey(key)) return true;
  return plan === "studio";
}
