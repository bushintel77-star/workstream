import fp from 'fastify-plugin';
import { clerkPlugin, getAuth } from '@clerk/fastify';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { assertAuthConfigured, isAuthRequired } from '../lib/auth-config';
import { bindOwnerSecrets } from '../lib/owner-secrets';
import { annotateActiveSpan, setTelemetryAttributes } from '../lib/telemetry';

declare module 'fastify' {
  interface FastifyRequest {
    /** Data scope: the workspace owner id that owns the rows being accessed. */
    userId?: string;
    /** The authenticated Clerk user (same as userId for workspace owners). */
    actorId?: string;
    workspaceRole?: 'owner' | 'operator';
  }
}

const DEV_USER_ID = process.env.DEV_USER_ID ?? 'dev-user';

function isClerkConfigured(): boolean {
  return !!process.env.CLERK_SECRET_KEY;
}

function isDevAuthAllowed(): boolean {
  return !isAuthRequired();
}

/**
 * Bind the request to a workspace and its owner-scoped secrets.
 *
 * A user resolves to the workspace they already belong to (owner row or an
 * invited operator row). A user with no membership yet is a fresh solo
 * operator — they get their own owner workspace, which keeps the existing
 * first-run experience and migrates existing owner rows without data moves
 * (a solo owner's `workspace_id` already equals their Clerk id).
 */
async function bindWorkspace(
  request: FastifyRequest,
  reply: FastifyReply,
  userId: string,
): Promise<void> {
  const store = request.server.store;
  const member = await store.findWorkspaceByUser(userId);
  if (member) {
    request.userId = member.workspace_id;
    request.workspaceRole = member.role;
  } else {
    try {
      await store.ensureWorkspaceMember(userId, userId, 'owner');
    } catch (err) {
      const code = (err as Error & { code?: string }).code;
      if (code === 'SEAT_LIMIT') {
        reply.code(403).send({
          error: 'Seat limit reached',
          hint: 'Upgrade seats on the Design & Build License',
        });
        return;
      }
      throw err;
    }
    request.userId = userId;
    request.workspaceRole = 'owner';
  }
  const scopeId = request.userId!;
  request.actorId = userId;
  await bindOwnerSecrets(store, scopeId);
  if (request.telemetrySpan) {
    setTelemetryAttributes(request.telemetrySpan, {
      'operator.id': scopeId,
      'actor.id': userId,
    });
  }
  annotateActiveSpan({
    'operator.id': scopeId,
    'actor.id': userId,
  });
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!isClerkConfigured()) {
    if (!isDevAuthAllowed()) {
      return reply.code(503).send({
        error: 'Authentication is not configured',
        hint: 'Set CLERK_SECRET_KEY on the API service',
      });
    }
    await bindWorkspace(request, reply, DEV_USER_ID);
    return;
  }

  const auth = getAuth(request);
  if (!auth.userId) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  await bindWorkspace(request, reply, auth.userId);
}

/**
 * Owner-only gate for billing, integration-secret, and membership
 * administration. Callers return immediately when this returns false.
 */
export function requireWorkspaceOwner(
  request: FastifyRequest,
  reply: FastifyReply,
): boolean {
  if (request.workspaceRole !== 'owner') {
    reply.code(403).send({
      error: 'Workspace owner access required',
      hint: 'Only the workspace owner can manage billing, integration secrets, or team membership.',
    });
    return false;
  }
  return true;
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
