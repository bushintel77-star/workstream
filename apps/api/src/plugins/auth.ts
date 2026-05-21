import fp from 'fastify-plugin';
import { clerkPlugin, getAuth } from '@clerk/fastify';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { assertAuthConfigured, isAuthRequired } from '../lib/auth-config';
import { hydrateEnvForOwner } from '../lib/integration-secrets';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
  }
}

const clerkConfigured = !!process.env.CLERK_SECRET_KEY;
const devAuthAllowed = !isAuthRequired();

const DEV_USER_ID = process.env.DEV_USER_ID ?? 'dev-user';

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!clerkConfigured) {
    if (!devAuthAllowed) {
      return reply.code(503).send({
        error: 'Authentication is not configured',
        hint: 'Set CLERK_SECRET_KEY on the API service',
      });
    }
    request.userId = DEV_USER_ID;
    await hydrateEnvForOwner(request.server.store, DEV_USER_ID);
    return;
  }

  const auth = getAuth(request);
  if (!auth.userId) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  request.userId = auth.userId;
  await hydrateEnvForOwner(request.server.store, auth.userId);
}

export default fp(
  async function authPlugin(fastify: FastifyInstance) {
    assertAuthConfigured();

    if (!clerkConfigured) {
      if (devAuthAllowed) {
        fastify.log.warn('CLERK_SECRET_KEY not set — dev-user auth only (local)');
      }
      return;
    }

    await fastify.register(clerkPlugin);
  },
  { name: 'auth' },
);
