import type { Store } from "@workstream/db";
import {
  LICENSE_PRODUCT_NAME,
  type WorkspaceLicense,
} from "@workstream/contracts";

/** Snapshot of Design & Build License for Settings / hub. */
export async function getWorkspaceLicense(
  store: Store,
  ownerId: string,
): Promise<WorkspaceLicense> {
  const billing = await store.getWorkspaceBilling(ownerId);
  await store.ensureWorkspaceMember(ownerId, ownerId, "owner");
  const members = await store.listWorkspaceMembers(ownerId);
  const seatsUsed = members.length;
  return {
    product_name: LICENSE_PRODUCT_NAME,
    plan: billing.plan,
    seat_limit: billing.seat_limit,
    seats_used: seatsUsed,
    seats_available: Math.max(0, billing.seat_limit - seatsUsed),
    live_integrations: billing.plan === "studio",
    stripe_customer_id: billing.stripe_customer_id ?? null,
    stripe_subscription_id: billing.stripe_subscription_id ?? null,
    members,
  };
}
