import type { Store } from "@workstream/db";
import { bindOwnerSecrets, getOwnerEnv } from "./owner-secrets";

export async function resolveSecret(
  store: Store,
  ownerId: string,
  key: string,
): Promise<string | null> {
  const row = await store.getIntegration(ownerId, key);
  if (row?.value) return row.value;
  return getOwnerEnv(key) ?? null;
}

/** Bind owner secrets for the current async context (replaces process.env mutation). */
export async function hydrateEnvForOwner(
  store: Store,
  ownerId: string,
): Promise<void> {
  await bindOwnerSecrets(store, ownerId);
}
