import Redis from "ioredis";

const TTL_MS = 24 * 60 * 60 * 1000;
const TTL_SEC = 24 * 60 * 60;
const MAX_ENTRIES = 500;
const REDIS_PREFIX = "pipeline-idempotency:";

type Entry = { body: unknown; expires: number };

const memory = new Map<string, Entry>();

let redisClient: Redis | null = null;

function redisEnabled(): boolean {
  return !!process.env.REDIS_URL?.trim();
}

function getRedis(): Redis | null {
  if (!redisEnabled()) return null;
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
  }
  return redisClient;
}

export function pipelineIdempotencyKey(
  ownerId: string,
  projectId: string,
  key: string,
): string {
  return `${ownerId}:${projectId}:${key}`;
}

function memoryGet(cacheKey: string): unknown | null {
  const entry = memory.get(cacheKey);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    memory.delete(cacheKey);
    return null;
  }
  return entry.body;
}

function memorySet(cacheKey: string, body: unknown): void {
  memory.set(cacheKey, { body, expires: Date.now() + TTL_MS });
  if (memory.size > MAX_ENTRIES) {
    const first = memory.keys().next().value;
    if (first) memory.delete(first);
  }
}

export async function getIdempotentPipelineResponse(
  cacheKey: string,
): Promise<unknown | null> {
  const redis = getRedis();
  if (redis) {
    try {
      if (redis.status !== "ready") await redis.connect();
      const raw = await redis.get(`${REDIS_PREFIX}${cacheKey}`);
      if (!raw) return memoryGet(cacheKey);
      return JSON.parse(raw) as unknown;
    } catch {
      return memoryGet(cacheKey);
    }
  }
  return memoryGet(cacheKey);
}

export async function setIdempotentPipelineResponse(
  cacheKey: string,
  body: unknown,
): Promise<void> {
  memorySet(cacheKey, body);
  const redis = getRedis();
  if (!redis) return;
  try {
    if (redis.status !== "ready") await redis.connect();
    await redis.set(
      `${REDIS_PREFIX}${cacheKey}`,
      JSON.stringify(body),
      "EX",
      TTL_SEC,
    );
  } catch {
    /* memory cache already written */
  }
}

export function readIdempotencyHeader(
  header: string | string[] | undefined,
): string | null {
  const raw = Array.isArray(header) ? header[0] : header;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

/** Test hook — reset singleton client between tests if needed. */
export function resetPipelineIdempotencyRedisForTests(): void {
  if (redisClient) {
    redisClient.disconnect();
    redisClient = null;
  }
  memory.clear();
}
