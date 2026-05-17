import fp from 'fastify-plugin';
import { clerkPlugin, getAuth } from '@clerk/fastify';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
  }
}

const authEnabled = !!process.env.CLERK_SECRET_KEY;

const DEV_USER_ID = process.env.DEV_USER_ID ?? 'dev-user';

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!authEnabled) {
    request.userId = DEV_USER_ID;
    return;
  }

  const auth = getAuth(request);
  if (!auth.userId) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  request.userId = auth.userId;
}

export default fp(
  async function authPlugin(fastify: FastifyInstance) {
    if (!authEnabled) {
      fastify.log.warn('CLERK_SECRET_KEY not set — Clerk auth disabled');
      return;
    }

    await fastify.register(clerkPlugin);
  },
  { name: 'auth' },
);
