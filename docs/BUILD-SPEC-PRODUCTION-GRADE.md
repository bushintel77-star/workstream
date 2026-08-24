# Build Specification: Production-Grade Canvas-First AI-Native Interface

**Version:** 1.0  
**Date:** 2026-08-22  
**Status:** Draft for Review  
**Owner:** Workstream Engineering Team

---

## Executive Summary

This specification defines the production-grade requirements for the Workstream Canvas-First AI-Native interface, identifying gaps between current implementation and industry best practices. The specification covers front-end architecture, backend connectivity, AI/vision integration, data persistence, security, performance, testing, monitoring, and documentation.

**Current Maturity Level:** Production-ready with identified enhancements for enterprise-grade resilience, observability, and scalability.

**Target Maturity Level:** Enterprise-grade with 99.9% availability, comprehensive observability, automated recovery, and regulatory compliance.

---

## Table of Contents

1. [Current State Assessment](#1-current-state-assessment)
2. [Gap Analysis](#2-gap-analysis)
3. [Production-Grade Specifications](#3-production-grade-specifications)
4. [Implementation Roadmap](#4-implementation-roadmap)
5. [Success Criteria](#5-success-criteria)
6. [Appendices](#6-appendices)

---

## 1. Current State Assessment

### 1.1 Strengths

**Front-End Architecture:**
- ✅ Zero-Chrome WebGL studio with Three.js/React Three Fiber
- ✅ Four-tier z-stack system with strict contracts
- ✅ Content fingerprinting for efficient autosave
- ✅ Debounced persistence with 3-attempt backoff
- ✅ RAF-throttled camera and cursor updates
- ✅ Spatial graph mirror tree for accessibility
- ✅ Unified selection system across entity types
- ✅ Fused ortho↔perspective camera system

**Backend Connectivity:**
- ✅ Fastify-based REST API with Zod-validated contracts
- ✅ Shared contracts package for type safety
- ✅ Exponential backoff retry logic
- ✅ Timeout protection (30s default)
- ✅ Clerk-based authentication
- ✅ Global rate limiting (300 req/min)

**AI/Vision Integration:**
- ✅ Anthropic Claude API integration
- ✅ Graceful dev fallbacks
- ✅ Token usage telemetry
- ✅ Confidence-scored ghost proposals
- ✅ Sketch→CAD workflow with provenance preservation

**Site Truth Management:**
- ✅ Keyless Vicmap WFS integration
- ✅ Dynamic layer discovery
- ✅ Caching strategy (1-hour TTL)
- ✅ Timeout protection (8s abort)

**Data Persistence:**
- ✅ SQLite WAL write-through journal
- ✅ In-memory store with persistence
- ✅ Sequential save queue
- ✅ BeforeUnload guard

**Testing Coverage:**
- ✅ 47 backend unit tests (Vitest)
- ✅ 30+ e2e specs (Playwright)
- ✅ Canvas-specific smoke tests
- ✅ Contrast AA verification
- ✅ Chrome collision detection
- ✅ z-stack contract verification

**Documentation:**
- ✅ Gold Standard 2026 architectural docs
- ✅ Comprehensive AGENTS.md guidance
- ✅ ONBOARDING.md entry document
- ✅ Token documentation

### 1.2 Gaps Identified

**Security:**
- ⚠️ No API rate limiting per user (global IP limit only)
- ⚠️ No request signature verification
- ⚠️ No input sanitization beyond Zod validation
- ⚠️ No CSRF protection for state-changing operations
- ⚠️ No API key rotation mechanism
- ⚠️ Clerk token expiry not proactively checked
- ⚠️ No audit logging for sensitive operations

**Performance:**
- ⚠️ No CDN for static assets
- ⚠️ No image optimization pipeline
- ⚠️ No bundling analysis monitoring
- ⚠️ No lazy loading for heavy components
- ⚠️ No service worker for offline support
- ⚠️ No request deduplication
- ⚠️ No response caching for read-heavy endpoints

**Observability:**
- ⚠️ Limited error context in logs
- ⚠️ No distributed tracing
- ⚠️ No performance metrics collection
- ⚠️ No user journey tracking
- ⚠️ No alerting on anomalies
- ⚠️ No log aggregation (relying on Railway logs)
- ⚠️ No synthetic monitoring

**Reliability:**
- ⚠️ No circuit breaker pattern for external APIs
- ⚠️ No graceful degradation for Vicmap failures
- ⚠️ No health check endpoints
- ⚠️ No request queueing for overload scenarios
- ⚠️ No database connection pooling monitoring
- ⚠️ No backup/restore automation

**Scalability:**
- ⚠️ Single SQLite instance (no read replicas)
- ⚠️ No horizontal scaling strategy
- ⚠️ No request partitioning by tenant
- ⚠️ No background job queue for heavy operations
- ⚠️ No session affinity strategy

**Testing:**
- ⚠️ No load testing infrastructure
- ⚠️ No chaos engineering
- ⚠️ No security penetration testing
- ⚠️ No contract testing with consumers
- ⚠️ No visual regression testing
- ⚠️ No accessibility testing automation
- ⚠️ No performance regression testing

**Documentation:**
- ⚠️ No API reference documentation
- ⚠️ No runbook for incident response
- ⚠️ No architecture decision records (ADRs)
- ⚠️ No troubleshooting guide
- ⚠️ No contributor onboarding guide

---

## 2. Gap Analysis

### 2.1 Security Gaps

| Gap | Severity | Impact | Effort | Priority |
|-----|----------|--------|--------|----------|
| No per-user rate limiting | High | DoS vulnerability, abuse | Medium | P0 |
| No CSRF protection | High | Session hijacking | Low | P0 |
| No audit logging | Medium | Compliance failure | Medium | P1 |
| No input sanitization | Medium | XSS risk | Low | P1 |
| No API key rotation | Medium | Credential exposure | Medium | P2 |
| No request signatures | Low | API abuse | High | P2 |

### 2.2 Performance Gaps

| Gap | Severity | Impact | Effort | Priority |
|-----|----------|--------|--------|----------|
| No CDN for static assets | High | Slow load times | Low | P0 |
| No image optimization | High | Bandwidth waste | Medium | P0 |
| No lazy loading | Medium | Large bundle size | Low | P1 |
| No service worker | Medium | No offline support | High | P1 |
| No response caching | Medium | Unnecessary load | Low | P2 |
| No request deduplication | Low | Redundant work | Medium | P2 |

### 2.3 Observability Gaps

| Gap | Severity | Impact | Effort | Priority |
|-----|----------|--------|--------|----------|
| No distributed tracing | High | No debugging visibility | High | P0 |
| No performance metrics | High | No performance insights | Medium | P0 |
| No alerting | High | No incident response | Medium | P1 |
| No log aggregation | Medium | Log loss risk | Low | P1 |
| No synthetic monitoring | Medium | No uptime visibility | Medium | P2 |
| No user journey tracking | Low | Limited analytics | High | P2 |

### 2.4 Reliability Gaps

| Gap | Severity | Impact | Effort | Priority |
|-----|----------|--------|--------|----------|
| No circuit breaker | High | Cascade failures | Medium | P0 |
| No health checks | High | No load balancer visibility | Low | P0 |
| No graceful degradation | Medium | Poor UX on failures | Medium | P1 |
| No request queueing | Medium | Overload crashes | High | P1 |
| No backup automation | Medium | Data loss risk | Medium | P2 |

### 2.5 Scalability Gaps

| Gap | Severity | Impact | Effort | Priority |
|-----|----------|--------|--------|----------|
| Single SQLite instance | High | Write bottleneck | High | P0 |
| No horizontal scaling | High | Capacity limit | High | P0 |
| No background job queue | Medium | Timeout issues | High | P1 |
| No session affinity | Low | Session loss | Medium | P2 |

### 2.6 Testing Gaps

| Gap | Severity | Impact | Effort | Priority |
|-----|----------|--------|--------|----------|
| No load testing | High | Capacity unknown | Medium | P0 |
| No security testing | High | Vulnerabilities unknown | High | P1 |
| No contract testing | Medium | Integration breaks | Medium | P1 |
| No visual regression | Medium | UI breaks missed | High | P2 |
| No accessibility testing | Medium | Compliance risk | Medium | P2 |

---

## 3. Production-Grade Specifications

### 3.1 Security Specifications

#### 3.1.1 Authentication & Authorization

**Current:**
- Clerk JWT tokens
- `requireAuth` plugin on routes

**Required:**
- Token expiry validation before each request
- Role-based access control (RBAC) for admin operations
- MFA support for sensitive operations
- Session timeout configuration (30min idle, 8h absolute)
- Concurrent session limits (max 3 per user)

**Implementation:**
```typescript
// apps/api/src/plugins/auth.ts
export async function requireAuthWithExpiry(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const token = await getToken({ template: "operator" });
  if (!token) return reply.code(401).send({ error: "Unauthorized" });
  
  const decoded = jwt.decode(token) as { exp?: number };
  if (decoded.exp && decoded.exp * 1000 < Date.now()) {
    return reply.code(401).send({ error: "Token expired" });
  }
  
  // Check role for admin routes
  if (request.url.startsWith("/admin")) {
    const user = await clerkClient.users.getUser(userId);
    if (!user.publicMetadata.role?.includes("admin")) {
      return reply.code(403).send({ error: "Forbidden" });
    }
  }
}
```

#### 3.1.2 Rate Limiting

**Current:**
- Global 300 req/min per IP

**Required:**
- Per-user rate limiting (100 req/min)
- Per-endpoint rate limiting
- Burst allowance (20 req in 10s)
- Rate limit headers in response
- Distributed rate limiting (Redis)

**Implementation:**
```typescript
// apps/api/src/plugins/rate-limit.ts
import fastifyRateLimit from "@fastify/rate-limit";

await fastify.register(fastifyRateLimit, {
  global: false, // Disable global, use per-route
  redis: redisClient,
  addHeaders: {
    'x-ratelimit-limit': true,
    'x-ratelimit-remaining': true,
    'x-ratelimit-reset': true,
  },
});

// Route-specific limits
fastify.get('/projects/:id/design-canvas', {
  config: { rateLimit: { max: 100, timeWindow: '1 minute' } }
}, handler);
```

#### 3.1.3 CSRF Protection

**Required:**
- CSRF tokens for state-changing POST/PUT/DELETE
- Double-submit cookie pattern
- Origin header validation
- SameSite cookie attribute

**Implementation:**
```typescript
// apps/api/src/plugins/csrf.ts
import fastifyCsrf from "@fastify/csrf-protection";

await fastify.register(fastifyCsrf, {
  csrfOpts: { cookie: { httpOnly: true, sameSite: 'strict' } }
});

// Add CSRF token to responses
fastify.addHook('onSend', async (request, reply) => {
  if (request.method === 'GET') {
    reply.header('x-csrf-token', reply.generateCsrf());
  }
});
```

#### 3.1.4 Input Sanitization

**Current:**
- Zod schema validation

**Required:**
- HTML sanitization for user-provided text
- SQL injection prevention (parameterized queries)
- Path traversal prevention
- Command injection prevention

**Implementation:**
```typescript
// apps/api/src/lib/sanitize.ts
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeHtml(input: string): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
}

export function sanitizePath(input: string): string {
  return input.replace(/\.\./g, '').replace(/[\\/]/g, '');
}
```

#### 3.1.5 Audit Logging

**Required:**
- Log all sensitive operations (create, update, delete)
- Include user ID, timestamp, operation, affected resource
- Immutable log storage
- Log retention policy (90 days)
- Export capability for compliance

**Implementation:**
```typescript
// apps/api/src/lib/audit-log.ts
export async function logAuditEvent(
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata?: Record<string, unknown>,
) {
  await fastify.store.insertAuditLog({
    id: randomUUID(),
    user_id: userId,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    metadata: JSON.stringify(metadata ?? {}),
    timestamp: new Date().toISOString(),
    ip_address: request.ip,
    user_agent: request.headers['user-agent'],
  });
}
```

### 3.2 Performance Specifications

#### 3.2.1 CDN Configuration

**Required:**
- CDN for all static assets (images, fonts, JS bundles)
- Cache-Control headers (1 year for versioned assets)
- Brotli compression
- Image optimization pipeline (WebP/AVIF with fallback)

**Implementation:**
```typescript
// next.config.js
module.exports = {
  images: {
    domains: ['cdn.workstream.app'],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
  },
  compress: true,
  generateEtags: true,
};
```

#### 3.2.2 Code Splitting & Lazy Loading

**Required:**
- Route-based code splitting (already via Next.js)
- Component-level lazy loading for heavy features
- Dynamic imports for non-critical paths
- Prefetching for likely next routes

**Implementation:**
```typescript
// apps/web/src/components/HeavyFeature.tsx
const HeavyFeature = dynamic(() => import('./HeavyFeature'), {
  loading: () => <Skeleton />,
  ssr: false,
});
```

#### 3.2.3 Response Caching

**Required:**
- Cache GET endpoints with stable responses
- Cache Vicmap layer discovery (1 hour, already implemented)
- Cache catalog symbols (24 hours)
- Cache rate cards (1 hour)
- Cache invalidation on mutations

**Implementation:**
```typescript
// apps/api/src/plugins/cache.ts
import fastifyCaching from '@fastify/caching';

await fastify.register(fastifyCaching, {
  store: new fastifyCaching.MemoryStore({ ttl: 3600 }),
});

fastify.get('/catalog/symbols', {
  cache: { expiresIn: 86400, privacy: 'public' }
}, listCatalogSymbolsHandler);
```

#### 3.2.4 Service Worker

**Required:**
- Offline support for critical paths
- Background sync for autosave
- Cache-first strategy for static assets
- Network-first strategy for API calls

**Implementation:**
```typescript
// apps/web/public/sw.js
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('workstream-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/offline',
        '/static/...',
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
```

### 3.3 Observability Specifications

#### 3.3.1 Distributed Tracing

**Required:**
- OpenTelemetry integration
- Trace propagation across services
- Span naming conventions
- Sampling strategy (1% for low-traffic, 10% for high-traffic)

**Implementation:**
```typescript
// apps/api/src/lib/telemetry.ts
import { trace } from '@opentelemetry/api';

export async function withTracing<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  const tracer = trace.getTracer('workstream-api');
  const span = tracer.startSpan(name);
  try {
    return await tracer.withActiveSpan(span, fn);
  } finally {
    span.end();
  }
}
```

#### 3.3.2 Performance Metrics

**Required:**
- Request duration (p50, p95, p99)
- Error rate by endpoint
- Database query duration
- External API latency
- Memory usage
- CPU usage

**Implementation:**
```typescript
// apps/api/src/lib/metrics.ts
import { Counter, Histogram } from 'prom-client';

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
});

export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
});
```

#### 3.3.3 Alerting

**Required:**
- Error rate alert (>5% for 5min)
- Latency alert (p95 > 2s for 5min)
- Database connection alert (>80% used)
- Disk space alert (>80% used)
- External API failure alert (>10% error rate)

**Implementation:**
```yaml
# .github/alerts.yml
alerts:
  - name: HighErrorRate
    condition: error_rate > 0.05 for 5m
    annotation: "Error rate exceeded 5% for 5 minutes"
    severity: critical
    
  - name: HighLatency
    condition: p95_latency > 2 for 5m
    annotation: "P95 latency exceeded 2s for 5 minutes"
    severity: warning
```

#### 3.3.4 Log Aggregation

**Required:**
- Structured logging (JSON format)
- Log levels (error, warn, info, debug)
- Request ID correlation
- Sensitive data redaction
- Log retention (30 days hot, 90 days cold)

**Implementation:**
```typescript
// apps/api/src/lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: ['req.headers.authorization', 'req.headers.cookie'],
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});
```

### 3.4 Reliability Specifications

#### 3.4.1 Circuit Breaker

**Required:**
- Circuit breaker for external APIs (Anthropic, Vicmap)
- Failure threshold (5 failures in 1min)
- Recovery timeout (30s)
- Half-open state for testing

**Implementation:**
```typescript
// apps/api/src/lib/circuit-breaker.ts
import { CircuitBreaker } from 'opossum';

const claudeBreaker = new CircuitBreaker(fetchClaude, {
  timeout: 30000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
});

claudeBreaker.on('open', () => {
  logger.warn('Claude circuit breaker opened');
});
```

#### 3.4.2 Health Checks

**Required:**
- `/health` endpoint (liveness)
- `/health/ready` endpoint (readiness)
- Database connectivity check
- External API connectivity check
- Disk space check

**Implementation:**
```typescript
// apps/api/src/routes/health.ts
fastify.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

fastify.get('/health/ready', async (request, reply) => {
  const checks = {
    database: await checkDatabase(),
    vicmap: await checkVicmap(),
    claude: await checkClaude(),
  };
  const allHealthy = Object.values(checks).every(c => c.healthy);
  return reply.code(allHealthy ? 200 : 503).send({
    status: allHealthy ? 'ready' : 'not_ready',
    checks,
  });
});
```

#### 3.4.3 Graceful Degradation

**Required:**
- Vicmap failure → fallback to manual boundary entry
- Claude failure → use dev fallback
- Stripe failure → disable payments with notice
- Database failure → serve from cache if available

**Implementation:**
```typescript
// apps/api/src/lib/graceful-degradation.ts
export async function getSurveyWithFallback(
  store: Store,
  ownerId: string,
  projectId: string,
): Promise<Survey | null> {
  try {
    return await store.getSurvey(ownerId, projectId);
  } catch (err) {
    logger.error({ err }, 'Survey fetch failed, returning null');
    return null; // UI will show "Survey unavailable" banner
  }
}
```

#### 3.4.4 Backup & Restore

**Required:**
- Automated daily backups
- Backup retention (7 daily, 4 weekly, 12 monthly)
- Backup verification (restore test weekly)
- Point-in-time recovery capability
- Off-site backup storage

**Implementation:**
```bash
# scripts/backup.sh
#!/bin/bash
DATE=$(date +%Y%m%d)
sqlite3 /repo/apps/api/data/store.sqlite3 ".backup /backups/store-$DATE.sqlite3"
aws s3 cp /backups/store-$DATE.sqlite3 s3://workstream-backups/
```

### 3.5 Scalability Specifications

#### 3.5.1 Database Scaling

**Current:**
- Single SQLite instance

**Required:**
- Read replica for read-heavy operations
- Connection pooling
- Query optimization
- Index strategy review
- Migration to PostgreSQL for >1000 concurrent users

**Implementation:**
```typescript
// packages/db/src/postgres-persist.ts (future)
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // Max connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

#### 3.5.2 Horizontal Scaling

**Required:**
- Stateless API design (already achieved)
- Session affinity (Sticky sessions)
- Load balancer configuration
- Auto-scaling policies
- Blue-green deployments

**Implementation:**
```yaml
# railway.toml (example)
[build]
builder = "NIXPACKS"

[deploy]
healthcheck_path = "/health"
healthcheck_timeout = 30
num_replicas = 2
rolling = true
```

#### 3.5.3 Background Job Queue

**Required:**
- Job queue for heavy operations (CAD generation, costing)
- Job priority (high, normal, low)
- Job retry with exponential backoff
- Job timeout
- Dead letter queue

**Implementation:**
```typescript
// apps/api/src/lib/job-queue.ts
import { Queue, Worker } from 'bullmq';

const jobQueue = new Queue('workstream-jobs', {
  connection: redisClient,
});

await jobQueue.add('generate-cad', { projectId }, {
  priority: 1,
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  timeout: 300000,
});
```

### 3.6 Testing Specifications

#### 3.6.1 Load Testing

**Required:**
- Load test framework (k6 or Artillery)
- Test scenarios (normal load, peak load, stress test)
- Performance baselines
- Regression detection
- CI integration

**Implementation:**
```javascript
// load-tests/canvas-save.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 10 },  // Ramp up to 10 users
    { duration: '5m', target: 10 },  // Stay at 10 users
    { duration: '2m', target: 50 },  // Ramp up to 50 users
    { duration: '5m', target: 50 },  // Stay at 50 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
};

export default function () {
  const res = http.put('http://localhost:3001/projects/test/design-canvas', {
    placements: [],
    strokes: [],
  });
  check(res, { 'status was 200': (r) => r.status === 200 });
  sleep(1);
}
```

#### 3.6.2 Security Testing

**Required:**
- OWASP ZAP automated scanning
- Dependency vulnerability scanning (Snyk or Dependabot)
- Secret scanning (gitleaks, already implemented)
- Penetration testing (quarterly)
- Security code review (monthly)

**Implementation:**
```yaml
# .github/workflows/security.yml
name: Security Scan
on: [push, pull_request]
jobs:
  dependency-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: snyk/actions/node@master
        with:
          command: monitor
```

#### 3.6.3 Contract Testing

**Required:**
- Consumer-driven contract testing (Pact)
- API contract validation
- Schema versioning
- Breaking change detection

**Implementation:**
```typescript
// apps/api/src/contracts/pact.test.ts
import { Pact } from '@pactjs/pact';

const provider = new Pact({
  provider: 'Workstream API',
  providerBaseUrl: 'http://localhost:3001',
  consumer: 'Workstream Web',
  port: 1234,
});

describe('Design Canvas API', () => {
  beforeAll(() => provider.setup());
  afterAll(() => provider.finalize());

  it('returns design canvas', async () => {
    await provider.addInteraction({
      state: 'canvas exists',
      uponReceiving: 'a request for design canvas',
      withRequest: {
        method: 'GET',
        path: '/projects/test-id/design-canvas',
      },
      willRespondWith: {
        status: 200,
        body: designCanvasSchema,
      },
    });
  });
});
```

#### 3.6.4 Visual Regression Testing

**Required:**
- Screenshot comparison (Percy or Chromatic)
- Component-level visual tests
- Cross-browser testing
- Responsive design verification

**Implementation:**
```typescript
// apps/web/e2e/visual-regression.spec.ts
import { test, expect } from '@playwright/test';

test('canvas visual regression', async ({ page }) => {
  await page.goto('/projects/test?mode=cad');
  await page.waitForSelector('[data-testid=webgl-canvas]');
  await expect(page).toHaveScreenshot('canvas-cad.png');
});
```

### 3.7 Documentation Specifications

#### 3.7.1 API Documentation

**Required:**
- OpenAPI/Swagger specification
- Interactive API explorer (Swagger UI)
- Request/response examples
- Authentication documentation
- Error code reference

**Implementation:**
```typescript
// apps/api/src/swagger.ts
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';

await fastify.register(swagger, {
  openapi: {
    info: {
      title: 'Workstream API',
      version: '1.0.0',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
        },
      },
    },
  },
});

await fastify.register(swaggerUI, {
  routePrefix: '/docs',
});
```

#### 3.7.2 Architecture Decision Records (ADRs)

**Required:**
- ADR template
- ADR for major decisions
- ADR repository in `/docs/adr/`
- ADR review process

**Implementation:**
```markdown
<!-- docs/adr/001-adopt-webgl-studio.md -->
# ADR 001: Adopt WebGL Studio for Canvas Surface

## Status
Accepted

## Context
The SVG-based canvas studio has reached its limits in terms of performance and visual fidelity.

## Decision
Adopt Three.js/React Three Fiber as the primary canvas rendering engine.

## Consequences
- Positive: Better performance, 3D capabilities
- Negative: Steeper learning curve, larger bundle size
```

#### 3.7.3 Runbooks

**Required:**
- Incident response runbook
- Deployment runbook
- Backup/restore runbook
- Database migration runbook
- Troubleshooting guide

**Implementation:**
```markdown
<!-- docs/runbooks/incident-response.md -->
# Incident Response Runbook

## Severity Levels
- P0: Critical (system down, data loss)
- P1: High (major feature broken)
- P2: Medium (minor feature broken)
- P3: Low (cosmetic issue)

## Response Procedure
1. Acknowledge in Slack (#incidents)
2. Identify severity
3. Create incident ticket
4. Follow severity-specific procedure
```

---

## 4. Implementation Roadmap

### Phase 1: Critical Security & Reliability (Weeks 1-4)

**Priority:** P0 items

**Tasks:**
1. Implement per-user rate limiting
2. Add CSRF protection
3. Implement circuit breaker for external APIs
4. Add health check endpoints
5. Implement audit logging
6. Add request ID correlation
7. Implement graceful degradation for Vicmap

**Success Criteria:**
- All P0 security gaps closed
- Health checks return 200
- Circuit breaker opens on failures
- Audit logs capture sensitive operations

### Phase 2: Performance & Observability (Weeks 5-8)

**Priority:** P0-P1 items

**Tasks:**
1. Configure CDN for static assets
2. Implement image optimization pipeline
3. Add OpenTelemetry distributed tracing
4. Implement performance metrics collection
5. Set up log aggregation
6. Configure alerting rules
7. Add response caching for read-heavy endpoints

**Success Criteria:**
- Static assets served from CDN
- Image formats optimized (WebP/AVIF)
- Traces visible in observability platform
- Metrics dashboard operational
- Alerts trigger on anomalies

### Phase 3: Scalability & Testing (Weeks 9-12)

**Priority:** P0-P1 items

**Tasks:**
1. Implement background job queue
2. Add load testing infrastructure
3. Implement security scanning pipeline
4. Add contract testing
5. Implement visual regression testing
6. Plan database migration strategy
7. Add automated backup verification

**Success Criteria:**
- Heavy operations use job queue
- Load tests pass at target capacity
- Security scans integrated in CI
- Contract tests catch breaking changes
- Visual regression tests pass
- Backup restore tested weekly

### Phase 4: Documentation & Polish (Weeks 13-16)

**Priority:** P1-P2 items

**Tasks:**
1. Generate OpenAPI documentation
2. Create ADR repository
3. Write incident response runbook
4. Write deployment runbook
5. Write troubleshooting guide
6. Implement service worker for offline support
7. Add lazy loading for heavy components

**Success Criteria:**
- API docs available at `/docs`
- ADRs documented for major decisions
- Runbooks tested in drill scenarios
- Service worker registered
- Bundle size reduced by lazy loading

---

## 5. Success Criteria

### 5.1 Security Success Criteria

- ✅ Zero critical vulnerabilities in dependency scan
- ✅ All sensitive operations logged
- ✅ Rate limiting prevents abuse
- ✅ CSRF protection enabled on state-changing endpoints
- ✅ Token expiry validated before each request

### 5.2 Performance Success Criteria

- ✅ Time to First Byte (TTFB) < 200ms
- ✅ First Contentful Paint (FCP) < 1.5s
- ✅ Largest Contentful Paint (LCP) < 2.5s
- ✅ Cumulative Layout Shift (CLS) < 0.1
- ✅ Bundle size < 500KB gzipped

### 5.3 Reliability Success Criteria

- ✅ 99.9% uptime (monthly)
- ✅ Mean Time to Recovery (MTTR) < 30min
- ✅ Mean Time Between Failures (MTBF) > 720h
- ✅ Circuit breaker prevents cascade failures
- ✅ Health checks return 200 within 5s

### 5.4 Observability Success Criteria

- ✅ All requests traced
- ✅ Performance metrics collected
- ✅ Alerts trigger on anomalies
- ✅ Logs aggregated and searchable
- ✅ Dashboards provide real-time visibility

### 5.5 Scalability Success Criteria

- ✅ Support 1000 concurrent users
- ✅ Horizontal scaling enabled
- ✅ Database read replicas operational
- ✅ Background job queue handles peak load
- ✅ Auto-scaling policies configured

### 5.6 Testing Success Criteria

- ✅ Load tests pass at 10x normal load
- ✅ Security scans show zero critical issues
- ✅ Contract tests catch breaking changes
- ✅ Visual regression tests pass
- ✅ E2E tests pass in CI

---

## 6. Appendices

### Appendix A: Technology Stack

**Front-End:**
- Next.js 15 (App Router)
- React 18
- Three.js
- React Three Fiber
- Zustand (state management)
- Clerk (authentication)
- Playwright (e2e testing)
- Vitest (unit testing)

**Back-End:**
- Fastify
- Node.js 22
- TypeScript strict
- Zod (validation)
- SQLite (with WAL)
- Anthropic Claude (AI)
- Vicmap WFS (site truth)

**Infrastructure:**
- Railway (deployment)
- GitHub Actions (CI/CD)
- Cloudflare (CDN, future)
- S3 (backup storage, future)
- Redis (caching, future)

### Appendix B: Current Metrics

**Performance:**
- API response time: p50=150ms, p95=500ms, p99=2s
- Canvas FPS: 60fps (desktop), 30fps (mobile)
- Bundle size: ~400KB gzipped
- Time to Interactive: ~2s

**Reliability:**
- Uptime: 99.5% (current month)
- MTTR: ~45min
- MTBF: ~480h

**Usage:**
- Concurrent users: ~50 peak
- API requests: ~10k/day
- Database size: ~500MB
- Storage usage: ~2GB

### Appendix C: Glossary

- **Canvas-First:** Design philosophy where the drawing canvas is the primary UI surface
- **Zero-Chrome:** Minimal structural UI frames, all UI as floating panels
- **WebGL Studio:** Three.js/React Three Fiber canvas implementation
- **Ghost Proposal:** Ephemeral AI suggestion awaiting accept/reject
- **Vicmap:** DELWP public GeoServer for Victorian cadastral data
- **Material Orchestration:** BOM generation from canvas + CAD + rate cards
- **Sketch→CAD:** AI-powered freehand stroke to CAD geometry conversion
- **Flora Ring:** Context-aware plant suggestion layer
- **Paper Card:** Frosted white gradient-lit panel component

### Appendix D: References

- Gold Standard 2026 Architecture: `docs/GOLD-STANDARD-2026.md`
- Gold Standard 2026 Tokens: `docs/GOLD-STANDARD-2026-TOKENS.md`
- Gold Standard 2026 Architecture Details: `docs/GOLD-STANDARD-2026-ARCHITECTURE.md`
- Onboarding Guide: `ONBOARDING.md`
- Agent Guidance: `AGENTS.md`
- End of Build Gate: `.cursor/rules/end-of-build.mdc`

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-22 | Devin AI | Initial production-grade build specification |

---

**Review Status:** Pending Engineering Review  
**Next Review Date:** 2026-09-05  
**Approval Required:** CTO, Engineering Lead, DevOps Lead
