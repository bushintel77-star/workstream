const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 500;

type Entry = { body: unknown; expires: number };

const cache = new Map<string, Entry>();

export function pipelineIdempotencyKey(
  ownerId: string,
  projectId: string,
  key: string,
): string {
  return `${ownerId}:${projectId}:${key}`;
}

export function getIdempotentPipelineResponse(
  cacheKey: string,
): unknown | null {
  const entry = cache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(cacheKey);
    return null;
  }
  return entry.body;
}

export function setIdempotentPipelineResponse(
  cacheKey: string,
  body: unknown,
): void {
  cache.set(cacheKey, { body, expires: Date.now() + TTL_MS });
  if (cache.size > MAX_ENTRIES) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
}

export function readIdempotencyHeader(
  header: string | string[] | undefined,
): string | null {
  const raw = Array.isArray(header) ? header[0] : header;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}
