import CircuitBreaker from 'opossum';
import type { FastifyInstance } from 'fastify';

/**
 * Circuit breaker configuration for external APIs.
 * 
 * Prevents cascade failures when external services (Claude, Vicmap) are
 * experiencing outages or degraded performance.
 */

export interface CircuitBreakerOptions {
  /** Number of failures before opening the circuit (default: 5). */
  failureThreshold?: number;
  /** Time in ms before attempting a recovery (default: 30000). */
  resetTimeout?: number;
  /** Timeout in ms for each request (default: 30000). */
  timeout?: number;
}

/**
 * Circuit breaker state for Claude API.
 */
export const claudeBreaker = new CircuitBreaker(
  async (fn: () => Promise<unknown>) => {
    return await fn();
  },
  {
    failureThreshold: 5,
    resetTimeout: 30000,
    timeout: 30000,
  },
);

/**
 * Circuit breaker state for Vicmap WFS API.
 */
export const vicmapBreaker = new CircuitBreaker(
  async (fn: () => Promise<unknown>) => {
    return await fn();
  },
  {
    failureThreshold: 5,
    resetTimeout: 30000,
    timeout: 8000, // Vicmap has 8s timeout in vicmap.ts
  },
);

/**
 * Circuit breaker state for Stripe API.
 */
export const stripeBreaker = new CircuitBreaker(
  async (fn: () => Promise<unknown>) => {
    return await fn();
  },
  {
    failureThreshold: 3,
    resetTimeout: 60000,
    timeout: 30000,
  },
);

/**
 * Circuit breaker state for external integrations (MYOB, Xero, etc.).
 */
export const integrationBreaker = new CircuitBreaker(
  async (fn: () => Promise<unknown>) => {
    return await fn();
  },
  {
    failureThreshold: 3,
    resetTimeout: 60000,
    timeout: 30000,
  },
);

/**
 * Register circuit breaker event listeners for logging.
 */
export function registerCircuitBreakerLogging(fastify: FastifyInstance): void {
  claudeBreaker.on('open', () => {
    fastify.log.warn('Claude circuit breaker opened');
  });
  claudeBreaker.on('halfOpen', () => {
    fastify.log.info('Claude circuit breaker half-open');
  });
  claudeBreaker.on('close', () => {
    fastify.log.info('Claude circuit breaker closed');
  });
  claudeBreaker.on('fallback', (err: unknown) => {
    fastify.log.error({ err }, 'Claude circuit breaker fallback');
  });

  vicmapBreaker.on('open', () => {
    fastify.log.warn('Vicmap circuit breaker opened');
  });
  vicmapBreaker.on('halfOpen', () => {
    fastify.log.info('Vicmap circuit breaker half-open');
  });
  vicmapBreaker.on('close', () => {
    fastify.log.info('Vicmap circuit breaker closed');
  });
  vicmapBreaker.on('fallback', (err: unknown) => {
    fastify.log.error({ err }, 'Vicmap circuit breaker fallback');
  });

  stripeBreaker.on('open', () => {
    fastify.log.warn('Stripe circuit breaker opened');
  });
  stripeBreaker.on('halfOpen', () => {
    fastify.log.info('Stripe circuit breaker half-open');
  });
  stripeBreaker.on('close', () => {
    fastify.log.info('Stripe circuit breaker closed');
  });
  stripeBreaker.on('fallback', (err: unknown) => {
    fastify.log.error({ err }, 'Stripe circuit breaker fallback');
  });

  integrationBreaker.on('open', () => {
    fastify.log.warn('Integration circuit breaker opened');
  });
  integrationBreaker.on('halfOpen', () => {
    fastify.log.info('Integration circuit breaker half-open');
  });
  integrationBreaker.on('close', () => {
    fastify.log.info('Integration circuit breaker closed');
  });
  integrationBreaker.on('fallback', (err: unknown) => {
    fastify.log.error({ err }, 'Integration circuit breaker fallback');
  });
}

/**
 * Get circuit breaker status for health checks.
 */
export function getCircuitBreakerStatus() {
  return {
    claude: {
      state: claudeBreaker.opened ? 'open' : claudeBreaker.halfOpen ? 'half-open' : 'closed',
      stats: claudeBreaker.stats,
    },
    vicmap: {
      state: vicmapBreaker.opened ? 'open' : vicmapBreaker.halfOpen ? 'half-open' : 'closed',
      stats: vicmapBreaker.stats,
    },
    stripe: {
      state: stripeBreaker.opened ? 'open' : stripeBreaker.halfOpen ? 'half-open' : 'closed',
      stats: stripeBreaker.stats,
    },
    integration: {
      state: integrationBreaker.opened ? 'open' : integrationBreaker.halfOpen ? 'half-open' : 'closed',
      stats: integrationBreaker.stats,
    },
  };
}
