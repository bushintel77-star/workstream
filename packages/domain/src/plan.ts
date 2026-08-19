import type { WorkspacePlan } from "@workstream/contracts";
import { LICENSE_PRODUCT_NAME } from "@workstream/contracts";

/** Solo operator — full pipeline, dev fallbacks for live connectors. */
export const LITE_SEAT_LIMIT = 1;

export { LICENSE_PRODUCT_NAME };

/** Keys that only perform live external calls on Studio plan. */
export const STUDIO_LIVE_INTEGRATION_KEYS = new Set([
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
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

/** Lite is always 1 seat; Studio starts at 1 and grows via seat checkout. */
export function defaultSeatLimit(plan: WorkspacePlan): number {
  return plan === "studio" ? 1 : LITE_SEAT_LIMIT;
}

export function canAddWorkspaceSeat(
  seatLimit: number,
  seatsUsed: number,
): boolean {
  return seatsUsed < seatLimit;
}

export function licenseLabel(plan: WorkspacePlan): string {
  return plan === "studio"
    ? `${LICENSE_PRODUCT_NAME} · Studio`
    : `${LICENSE_PRODUCT_NAME} · Lite`;
}
