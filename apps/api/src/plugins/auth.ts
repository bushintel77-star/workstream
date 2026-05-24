import fp from 'fastify-plugin';
import { clerkPlugin, getAuth } from '@clerk/fastify';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { assertAuthConfigured, isAuthRequired } from '../lib/auth-config';
import { bindOwnerSecrets } from '../lib/owner-secrets';
import { annotateActiveSpan } from '../lib/telemetry';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
  }
}

const DEV_USER_ID = process.env.DEV_USER_ID ?? 'dev-user';

function isClerkConfigured(): boolean {
  return !!process.env.CLERK_SECRET_KEY;
}

function isDevAuthAllowed(): boolean {
  return !isAuthRequired();
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!isClerkConfigured()) {
    if (!isDevAuthAllowed()) {
      return reply.code(503).send({
        error: 'Authentication is not configured',
        hint: 'Set CLERK_SECRET_KEY on the API service',
      });
    }
    request.userId = DEV_USER_ID;
    await bindOwnerSecrets(request.server.store, DEV_USER_ID);
    annotateActiveSpan({ "operator.id": DEV_USER_ID });
    return;
  }

  const auth = getAuth(request);
  if (!auth.userId) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  request.userId = auth.userId;
  await bindOwnerSecrets(request.server.store, auth.userId);
  annotateActiveSpan({ "operator.id": auth.userId });
}

export default fp(
  async function authPlugin(fastify: FastifyInstance) {
    assertAuthConfigured();

    if (!isClerkConfigured()) {
      if (isDevAuthAllowed()) {
        fastify.log.warn('CLERK_SECRET_KEY not set — dev-user auth only (local)');
      }
      return;
    }

    await fastify.register(clerkPlugin);
  },
  { name: 'auth' },
);
