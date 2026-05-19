import type { Store } from "@construct/db";

/**
 * Hydrate process.env with every saved integration token for `ownerId`.
 * Called on boot so the existing `process.env.X` reads in claude.ts /
 * mapbox.ts / stripe.ts / transcribe.ts pick up tokens the operator saved
 * through the Settings UI without those libs needing to be store-aware.
 *
 * Single-tenant by design. For multi-tenant the right shape is a
 * per-request `getSecret(key, ownerId)` and every call site threading
 * ownerId through.
 */
export async function hydrateEnvFromStore(
  store: Store,
  ownerId: string,
): Promise<void> {
  const items = await store.listIntegrations(ownerId);
  for (const i of items) {
    if (i.value) process.env[i.key] = i.value;
  }
}

export function setEnvSecret(key: string, value: string): void {
  process.env[key] = value;
}

export function clearEnvSecret(key: string): void {
  delete process.env[key];
}
