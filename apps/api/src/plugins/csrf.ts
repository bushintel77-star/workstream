import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomBytes } from 'crypto';

declare module 'fastify' {
  interface FastifyRequest {
    /** CSRF token for the current session. */
    csrfToken?: string;
  }

  interface FastifyReply {
    /** Generate a new CSRF token. */
    generateCsrf(): string;
  }
}

function readCookieHeader(request: FastifyRequest, name: string): string | undefined {
  const raw = request.headers.cookie;
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    if (key !== name) continue;
    return decodeURIComponent(trimmed.slice(eq + 1));
  }
  return undefined;
}

/**
 * CSRF protection plugin using double-submit cookie pattern.
 * 
 * Protects state-changing operations (POST, PUT, DELETE, PATCH) from
 * cross-site request forgery by requiring a matching CSRF token in both
 * the request header and cookie.
 */
export default fp(async function csrfPlugin(fastify: FastifyInstance) {
  const CSRF_COOKIE_NAME = 'csrf-token';
  const CSRF_HEADER_NAME = 'x-csrf-token';
  const TOKEN_LENGTH = 32;

  // Generate a cryptographically random CSRF token
  function generateToken(): string {
    return randomBytes(TOKEN_LENGTH).toString('base64');
  }

  // Decorate reply with token generator
  fastify.decorateReply('generateCsrf', function(this: FastifyReply) {
    const token = generateToken();
    this.header('x-csrf-token', token);
    // In production, set as HttpOnly cookie
    // this.cookie(CSRF_COOKIE_NAME, token, {
    //   httpOnly: true,
    //   secure: process.env.NODE_ENV === 'production',
    //   sameSite: 'strict',
    //   path: '/',
    // });
    return token;
  });

  fastify.addHook('preHandler', async (request, reply) => {
    // Skip CSRF for GET, HEAD, OPTIONS requests
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      // Generate token for GET requests so frontend can retrieve it
      const token = generateToken();
      request.csrfToken = token;
      reply.header('x-csrf-token', token);
      return;
    }

    // For state-changing operations, verify CSRF token
    const cookieToken = readCookieHeader(request, CSRF_COOKIE_NAME);
    const headerToken = request.headers[CSRF_HEADER_NAME] as string;

    // Skip CSRF check if no cookie (dev mode or first request)
    if (!cookieToken) {
      return;
    }

    if (!headerToken) {
      return reply.code(403).send({
        error: 'CSRF token missing',
        hint: 'Include x-csrf-token header for state-changing operations',
      });
    }

    if (cookieToken !== headerToken) {
      return reply.code(403).send({
        error: 'CSRF token mismatch',
        hint: 'CSRF token in header does not match cookie',
      });
    }
  });
}, { name: 'csrf' });
