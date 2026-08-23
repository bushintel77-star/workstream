import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";
import { getStore, initStore, type Store } from "@workstream/db";
import Redis from "ioredis";

declare module "fastify" {
  interface FastifyInstance {
    store: Store;
    redis?: Redis;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const store = await initStore();
  fastify.decorate("store", store);
  fastify.log.info("Store initialized (in-memory)");

  // Initialize Redis for distributed rate limiting, caching, and job queue
  let redis: Redis | undefined;
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) return null;
          return Math.min(times * 100, 3000);
        },
      });
      redis.on('error', (err) => {
        fastify.log.error({ err }, 'Redis connection error');
      });
      redis.on('connect', () => {
        fastify.log.info('Redis connected');
      });
      fastify.decorate("redis", redis);
    } catch (err) {
      fastify.log.error({ err }, 'Failed to initialize Redis');
    }
  } else {
    fastify.log.warn('REDIS_URL not set — distributed features disabled');
  }

  /* Integration tokens are deliberately NOT mirrored into process.env:
   * owner-secrets.ts scopes them per request/job via AsyncLocalStorage, and
   * a process-level mirror would let one workspace read another workspace's
   * connector credentials. */
});

export { getStore };
