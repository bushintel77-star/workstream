# Tier-1 stress test + gap analysis

**Date:** 2026-07-26  
**Branch context:** stress battery on `main` tip  
**Gold reference:** [TIER1-AI-CANVAS-GAP-AUDIT.md](./design/operator-redesign/design_handoff_landscape_cad_studio/TIER1-AI-CANVAS-GAP-AUDIT.md)

## What “tier-1” means under stress

Not Landmark parity. The Wrights Terrace DNA loop:

1. Address gate (`isTier1WrightsTerrace`) — Wrights + Prahran only  
2. Design massing (`tier1WrightsTerraceDesign`) — front entry + rear courtyard  
3. Cost lock (`ALW-TIER1-ALIGN`) — standard scenario **exactly** `$58,410.35`  
4. Savings ledger (`TIER1_WRIGHTS_SAVINGS`) — proposal v3 arithmetic  
5. Quote / portal surfaces that show the ledger when gated  

## Stress battery (kept)

| Suite | Path | Stress |
|-------|------|--------|
| Domain gate / design / CAD align | `packages/domain/src/tier1-wrights-terrace.stress.test.ts` | 500 address fuzz + 300 CAD aligns + 100 design calls |
| Costing pipeline | `apps/api/src/lib/cost-job.tier1-stress.test.ts` | 25 full survey→design→cost locks + re-cost ×10 |
| Baseline unit | `tier1-wrights-terrace.test.ts`, `cost-job.test.ts`, `studio-ai-assist.test.ts` | Parity + AI assist |

```bash
pnpm exec vitest run \
  packages/domain/src/tier1-wrights-terrace.test.ts \
  packages/domain/src/tier1-wrights-terrace.stress.test.ts \
  packages/domain/src/studio-ai-assist.test.ts \
  apps/api/src/lib/cost-job.test.ts \
  apps/api/src/lib/cost-job.tier1-stress.test.ts
```

## Results (executed 2026-07-26)

```text
Test Files  5 passed (5)
     Tests  26 passed (26)
```

| Check | Result |
|-------|--------|
| Address positive / negative / fuzz (500) | **PASS** |
| Savings ledger invariants ×200 | **PASS** (net_ex = deployed − removed; inc-GST is proposal-authored) |
| Design stability ×100 | **PASS** |
| CAD align ×300 | **PASS** → always `$58,410.35` on Wrights |
| Costing variants + 15× repeat + re-cost ×10 | **PASS** |
| Baseline cost-job tier-1 lock | **PASS** |
| Non-tier-1 Carlton must not lock | **PASS** |

## Gap scorecard vs gold (Workflow 1)

Updated from live code + stress stance (not Landmark chase).

| Pillar | Score | Stress-backed? | Gap |
|--------|------:|:--------------:|-----|
| Address gate | 4.5 | Yes | Near-miss “Wright Street / Wrights Road” correctly rejected; “Wrights Ter” accepted |
| Cost workbook lock | 5.0 | Yes | `$58,410.35` + `ALW-TIER1-ALIGN` deterministic |
| Design massing | 4.5 | Yes | Stable zones; vision quality still mock without Anthropic |
| Quote ledger UI | 4.0 | Partial | `QuoteSurface` + portal ledger; needs e2e click-path kept smoke |
| AI HITL on Wrights | 4.0 | Unit | Assist/ghosts prefer tier-1 ribbons; vision optional |
| Persist / share honesty | 4.0 | Audit Done | P0.1–P0.3 closed on handoff |
| Site intel (Vicmap/BYDA) | 3.0 | Live code | Title/easement LIVE; BYDA still chase for dig |
| Drafting / Fit sheet | 3.7 | Prior e2e | Indicative Workflow 1 — Stage 2 deferred |
| Clay walk / 3D moodboard | 1.0 | Out of scope | P3 defer |

### Still open (Workflow 1 leverage)

1. **P2.1** — Vision canopy clusters when API returns them (heuristic fallback stays)  
2. **Kept Quote e2e** — Wrights address → Quote mode → ledger visible + total chip  
3. **P3.3** — Multi-council compliance beyond Stonnington  
4. **Human ops** — Clerk, Litestream, Anthropic/Mapbox for quality (not blockers for demo lock)

### Explicitly not gaps

- Stage 2 metre CAD / DXF / grading  
- Live BYDA underground APIs  
- Multiplayer / Postgres  

## Fortune-500 expansion

See [TIER1-FORTUNE500-READINESS.md](./TIER1-FORTUNE500-READINESS.md) for the expanded battery (2000-address fuzz, concurrent costing, portal token hygiene, dual-session Quote e2e).

## Verdict

Tier-1 **money + massing lock is stress-hard**: address gate, design shape, and `$58,410.35` standard costing hold under repeated and fuzzed load. Remaining tier-1 product gaps are **surface polish** (vision quality) and **site due-diligence chase** (BYDA), not workbook arithmetic. Quote e2e + portal honesty are covered in the Fortune-500 battery.
