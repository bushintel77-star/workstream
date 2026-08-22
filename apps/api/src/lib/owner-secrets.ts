import { AsyncLocalStorage } from "node:async_hooks";
import type { Store } from "@workstream/db";
import { canUseLiveIntegration } from "@workstream/domain";

const ownerSecrets = new AsyncLocalStorage<Map<string, string>>();

/**
 * Read an integration secret for the active owner context.
 *
 * Falls back to the deployment environment only outside production. A
 * process-level fallback in production would let one workspace's connector
 * run on another workspace's credentials (or on deploy-wide globals), which
 * is exactly the cross-tenant leak this module exists to prevent. Local
 * development keeps the fallback so a fresh checkout can demo without saving
 * every token through Settings first.
 */
export function getOwnerEnv(key: string): string | undefined {
  const scoped = ownerSecrets.getStore()?.get(key);
  if (scoped) return scoped;
  if (process.env.NODE_ENV === 'production') return undefined;
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

/**
 * Bind owner integration secrets to the current async context (request or job).
 *
 * Uses `enterWith`, which enters a fresh context that persists through the rest
 * of the current async chain. Call this at most once per request/job, at the
 * top of that chain, as the request and queue paths do. For nested or repeated
 * scoping use `runWithOwnerSecrets`, which restores the previous context on
 * exit.
 */
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
  const map = await buildOwnerSecretMap(store, ownerId);
  return ownerSecrets.run(map, () => fn());
}
