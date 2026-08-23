import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import Redis from 'ioredis';

declare module 'fastify' {
  interface FastifyRequest {
    /** Per-user rate limit remaining requests. */
    rateLimitRemaining?: number;
    /** Per-user rate limit reset timestamp. */
    rateLimitReset?: number;
  }
}

/**
 * Per-user rate limiting plugin.
 * 
 * Runs after authentication to enforce user-specific limits (100 req/min)
 * in addition to the global IP-based limit. Uses Redis for distributed
 * rate limiting across multiple API instances.
 */
export default fp(async function userRateLimitPlugin(
  fastify: FastifyInstance,
  options: { redis?: Redis },
) {
  const redis = options.redis;
  const WINDOW_MS = 60 * 1000; // 1 minute
  const MAX_REQUESTS = 100;

  if (!redis) {
    fastify.log.warn('Redis not configured — per-user rate limiting disabled');
    return;
  }

  fastify.addHook('preHandler', async (request, reply) => {
    // Skip rate limiting for unauthenticated requests (they're handled by global IP limit)
    if (!request.userId) {
      return;
    }

    const key = `ratelimit:user:${request.userId}`;
    const now = Date.now();
    const windowStart = now - WINDOW_MS;

    // Clean up old entries
    await redis.zremrangebyscore(key, 0, windowStart);

    // Count requests in current window
    const count = await redis.zcard(key);

    if (count >= MAX_REQUESTS) {
      const ttl = await redis.pttl(key);
      reply.header('X-RateLimit-Limit', MAX_REQUESTS.toString());
      reply.header('X-RateLimit-Remaining', '0');
      reply.header('X-RateLimit-Reset', ((now + ttl) / 1000).toFixed(0));
      reply.header('Retry-After', Math.ceil(ttl / 1000).toString());
      
      return reply.code(429).send({
        error: 'Too many requests',
        hint: 'Rate limit exceeded. Please wait before trying again.',
      });
    }

    // Add current request
    await redis.zadd(key, now, `${now}-${Math.random()}`);
    await redis.expire(key, WINDOW_MS / 1000 + 1);

    const remaining = MAX_REQUESTS - count - 1;
    const ttl = await redis.pttl(key);
    
    request.rateLimitRemaining = remaining;
    request.rateLimitReset = now + ttl;

    reply.header('X-RateLimit-Limit', MAX_REQUESTS.toString());
    reply.header('X-RateLimit-Remaining', remaining.toString());
    reply.header('X-RateLimit-Reset', ((now + ttl) / 1000).toFixed(0));
  });
}, { name: 'userRateLimit' });
