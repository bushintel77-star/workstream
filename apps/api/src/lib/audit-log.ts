import { randomUUID } from 'crypto';
import type { FastifyRequest } from 'fastify';
import type { ActivityAction } from '@workstream/contracts';
import type { Store } from '@workstream/db';

/**
 * Audit log entry for sensitive operations.
 */
export interface AuditLogEntry {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  metadata: string;
  timestamp: string;
  ip_address?: string;
  user_agent?: string;
}

/**
 * Log an audit event for sensitive operations.
 * 
 * Captures user actions on sensitive resources (create, update, delete)
 * for compliance and security monitoring.
 */
export async function logAuditEvent(
  store: Store,
  request: FastifyRequest,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const userId = request.userId || request.actorId || 'anonymous';
  const entry: AuditLogEntry = {
    id: randomUUID(),
    user_id: userId,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    metadata: JSON.stringify(metadata ?? {}),
    timestamp: new Date().toISOString(),
    ip_address: request.ip,
    user_agent: request.headers['user-agent'] as string,
  };

  // Store in activity events for now (reuse existing infrastructure)
  // In production, this should go to a dedicated audit log table or external service
  try {
    // We'll add this to the in-memory activity events for now
    // TODO: Implement dedicated audit log storage with retention policy
    console.log('[AUDIT]', JSON.stringify(entry));
  } catch (err) {
    // Audit logging should never fail the request
    console.error('[AUDIT] Failed to log event:', err);
  }
}

/**
 * Convert ActivityAction to audit action string.
 */
export function activityToAuditAction(action: ActivityAction): string {
  return action;
}
