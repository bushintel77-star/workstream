import { AsyncLocalStorage } from "node:async_hooks";
import type { Store } from "@workstream/db";
import { canUseLiveIntegration } from "@workstream/domain";

const ownerSecrets = new AsyncLocalStorage<Map<string, string>>();

/** Read integration secret for the active owner context, then Fly env fallback. */
export function getOwnerEnv(key: string): string | undefined {
  const scoped = ownerSecrets.getStore()?.get(key);
  if (scoped) return scoped;
  return process.env[key];
}

export async function buildOwnerSecretMap(
  store: Store,
  ownerId: string,
): Promise<Map<string, string>> {
  const billing = await store.getWorkspaceBilling(ownerId);
  const items = await store.listIntegrations(ownerId);
  const map = new Map<string, string>();
  for (const def of items) {
    if (!def.value) continue;
    if (!canUseLiveIntegration(billing.plan, def.key)) continue;
    map.set(def.key, def.value);
  }
  return map;
}

/** Bind owner integration secrets to the current async context (request or job). */
export async function bindOwnerSecrets(
  store: Store,
  ownerId: string,
): Promise<void> {
  const map = await buildOwnerSecretMap(store, ownerId);
  ownerSecrets.enterWith(map);
}

export async function runWithOwnerSecrets<T>(
  store: Store,
  ownerId: string,
  fn: () => Promise<T>,
): Promise<T> {
  await bindOwnerSecrets(store, ownerId);
  return fn();
}
