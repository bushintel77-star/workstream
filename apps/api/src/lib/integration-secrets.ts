import type { Store } from "@workstream/db";
import { canUseLiveIntegration } from "@workstream/domain";

export async function resolveSecret(
  store: Store,
  ownerId: string,
  key: string,
): Promise<string | null> {
  const row = await store.getIntegration(ownerId, key);
  if (row?.value) return row.value;
  return process.env[key] ?? null;
}

export async function hydrateEnvForOwner(
  store: Store,
  ownerId: string,
): Promise<void> {
  const billing = await store.getWorkspaceBilling(ownerId);
  const items = await store.listIntegrations(ownerId);
  for (const def of items) {
    const key = def.key;
    const value = def.value;
    if (!value) continue;
    if (!canUseLiveIntegration(billing.plan, key)) continue;
    process.env[key] = value;
  }
}
