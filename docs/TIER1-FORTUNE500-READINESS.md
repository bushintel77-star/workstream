# Tier-1 Fortune-500 readiness — test battery

**Date:** 2026-07-26  
**Companion:** [TIER1-STRESS-AND-GAP.md](./TIER1-STRESS-AND-GAP.md) · [TIER1-AI-CANVAS-GAP-AUDIT.md](./design/operator-redesign/design_handoff_landscape_cad_studio/TIER1-AI-CANVAS-GAP-AUDIT.md)

## What “Fortune-500 ready” means here

Not Landmark parity and not a SOC2 claim. It means the **Wrights Terrace money + honesty loop** holds under:

1. **Adversarial address gates** — near-miss streets/suburbs never unlock; noise envelopes that still contain Wrights+Prahran still unlock  
2. **Money lock invariance** — standard scenario always `$58,410.35` + `ALW-TIER1-ALIGN`; lean/buffer never receive the align SKU  
3. **Concurrency isolation** — parallel projects do not cross-contaminate locks or portal payloads  
4. **Portal token hygiene** — quote_view only; deposit tokens cannot read quote; tampered tokens 401  
5. **Surface honesty** — Quote ledger keys off **project create address**; share totals are operator-authored (no silent rewrite)  
6. **AI coaching honesty** — `tier1-massing` / hornbeam ghosts only when the tier-1 flag is true  

## Battery (kept)

| Layer | Path | Scale |
|-------|------|-------|
| Domain baseline stress | `packages/domain/src/tier1-wrights-terrace.stress.test.ts` | 500 fuzz · 300 CAD · 100 design |
| Domain Fortune-500 | `packages/domain/src/tier1-fortune500.stress.test.ts` | 2000 fuzz · 1000 idempotent align · 500 design · AI honesty |
| API baseline stress | `apps/api/src/lib/cost-job.tier1-stress.test.ts` | 15× pipeline · 10× re-cost |
| API Fortune-500 | `apps/api/src/lib/tier1-fortune500.stress.test.ts` | 12× concurrent · mixed isolation · pipeline ×20 · re-cost ×25 |
| Portal Fortune-500 | `apps/api/src/routes/portal.tier1-fortune500.test.ts` | Wrights/Carlton payload · scope · 50× magic-link |
| Quote e2e | `apps/web/e2e/quote-tier1.spec.ts` | Ledger on / off |
| Fortune-500 e2e | `apps/web/e2e/quote-tier1-fortune500.spec.ts` | Quote+share · portal JSON · dual-session |

### Run

```bash
pnpm exec vitest run \
  packages/domain/src/tier1-wrights-terrace.test.ts \
  packages/domain/src/tier1-wrights-terrace.stress.test.ts \
  packages/domain/src/tier1-fortune500.stress.test.ts \
  packages/domain/src/studio-ai-assist.test.ts \
  apps/api/src/lib/cost-job.test.ts \
  apps/api/src/lib/cost-job.tier1-stress.test.ts \
  apps/api/src/lib/tier1-fortune500.stress.test.ts \
  apps/api/src/routes/portal.tier1-fortune500.test.ts

cd apps/web && API_URL=http://localhost:3001 \
  PLAYWRIGHT_BASE_URL=http://localhost:3002 \
  pnpm exec playwright test e2e/quote-tier1.spec.ts e2e/quote-tier1-fortune500.spec.ts
```

E2E API must use `RATE_LIMIT_MAX=10000` (Playwright `webServer` sets this; a reused local API without it will fail create under load).

## Explicitly out of scope (not this battery)

- Clerk production auth / Litestream DR drills  
- Live BYDA / Stripe live-mode  
- Multiplayer / Postgres  
- Stage 2 survey-grade CAD  

## Results (executed 2026-07-26)

```text
Domain+API Fortune-500 units: 47 / 47
Quote + Fortune-500 e2e:      (see gate log on PR)
```
