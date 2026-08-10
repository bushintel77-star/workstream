# Staged Autonomous Build Plan — Workstream

**Objective:** Move the voice-first mobile processing pipeline (and all surrounding WIP/GAP work) to a fully autonomous, self-auditing, guard-railed staged build where each phase validates itself, fails fast with telemetry, and proceeds to the next phase only when gates pass.

**Scope:** This plan covers the voice processing pipeline, capture stage orchestration, mobile UX, and the WIP/GAP items that touch the same code paths. It does **not** firewalled stage-2 work (PostGIS, true 3D editing, neighbour occlusion, contour grading, hydraulic design).

---

## 1. WIP Inventory (currently in flight)

| ID | Area | File(s) | Status | What is missing |
|----|------|---------|--------|-----------------|
| W1 | Voice capture | `apps/mobile/app/(app)/recording.tsx` | Shipped batch | No streaming, no low-latency turns, no real confidence display |
| W2 | Processing UI | `apps/mobile/app/(app)/processing/[id].tsx` | Shipped but stubbed stages | `design`, `costing`, `audit` stages shown but not wired to a staged backend; manual "Send to canvas" button still required |
| W3 | Capture pipeline | `apps/api/src/lib/capture-pipeline.ts` | Only `transcription` → `survey` | Missing `design`, `costing`, `audit` orchestration; no stage gates |
| W4 | Voice intent | `packages/contracts/src/schemas/voice-intent.ts` | Contract exists | Confidence not populated, DIL consent not enforced, lexical classifier |
| W5 | Asset panel | `apps/web/.../assetPanel/*` | Recently fixed visual structure | Could still use richer categorisation, search ranking refinement |
| W6 | Hero overlay | `apps/web/.../instantPlanner/*` | Polished | Needs real geometry from placed assets, not only primitives |
| W7 | Pipeline stage jobs | `apps/api/src/lib/*-job.ts` | Jobs exist | No stage runner, no rollback, no per-stage audit |

## 2. GAP Inventory (relevant to this build)

From `docs/MASTER-GAP-ANALYSIS-2026-08-02.md` and `docs/WORKSTREAM-STATUS.md`:

| ID | Gap | Why it matters for autonomous build |
|----|-----|-------------------------------------|
| G10 | Prior audit/status docs are stale | Need authoritative single plan artifact (this doc) |
| G2-rem | Compliance/layers/BOM bottom-sheet variants only assets/data/inbox in `StudioSheetHost` | Processing detail views need sheet variants for stage evidence |
| G3-rem | Coarse-pointer placement path | Voice → design intent must tolerate mobile coarse input |
| P0 (Fortune-500) | No shared web `Button`/`Dialog` primitives | Mobile processing uses native `Pressable`; web/HITL surfaces need consistent accept/refine/undo |
| P0 (Fortune-500) | `window.confirm()` for destructive actions | Guard-rail "undo" should use branded Dialog, not native confirm |
| P0 (Fortune-500) | No view transitions between modes | Stage transitions (survey→sketch→CAD→quote→audit) need animated state changes |
| P1 (Fortune-500) | Studio mount blank-then-pop | Processing screen needs structured skeleton on cold load |
| P1 (Fortune-500) | No loading skeletons on dashboard | Project list should skeleton while pipeline state streams |
| P1 (Fortune-500) | No type scale | Stage labels/values should use tokenised type scale |
| P2 (Fortune-500) | No tooltip/shortcut overlay | Mobile HITL needs contextual "accept" / "refine" / "undo" tooltips |

## 3. Autonomous Staged Architecture

```
recording upload
  └─ Phase 1: Transcription
       ├─ self-audit: duration > 0, file readable, transcript non-empty
       ├─ guard: confidence >= 0.4 (configurable); below gate → flag for review
       └─ pass → project status: transcribed
  └─ Phase 2: Survey
       ├─ self-audit: title polygon exists or aerial geocoded
       ├─ guard: lot_area_m2 > 0, garden_area_m2 >= 0, no NaN
       ├─ fallback: aerial-only if Vicmap WFS fails
       └─ pass → project status: survey_review
  └─ Phase 3: Design (auto from transcript if confidence OK and design language)
       ├─ self-audit: survey present, mode detected, proposal has >= 1 zone
       ├─ guard: no hallucinated SKUs, all referenced materials exist in catalog
       ├─ guard: proposal fits within lot area (soft check)
       └─ pass → project status: design_review
  └─ Phase 4: Costing (auto after design review)
       ├─ self-audit: design present, canvas parseable, rate card non-empty
       ├─ guard: all billable lines have rates; POA lines flagged, not dropped
       ├─ guard: standard scenario total within order of magnitude sanity bound
       └─ pass → project status: cost_review
  └─ Phase 5: Audit (auto after costing)
       ├─ self-audit: design + costings present
       ├─ guard: runProjectAudit, blocking_count === 0
       ├─ guard: advisory findings recorded but do not block
       └─ pass → project status: outputs
  └─ Phase 6: Outputs (final packaging)
       ├─ self-audit: at least one costing exists, audit passed
       ├─ guard: share/portal payload can be serialised
       └─ pass → project status: complete
```

### Failure modes (no human gate)

- **Halt with evidence:** any phase can set `project.status = "{phase}_failed"` and store a `stage_findings` array.
- **Retry-able:** network/transient failures retry with exponential backoff up to 3 attempts.
- **Permanent block:** structural guard failures (missing lot area, impossible cost) do not retry.
- **Mobile UI:** shows the failed stage, the guard that tripped, the evidence, and a "Retry from last good" or "Back to project" action.

### DIL & consent

- `dil_consent` must be `true` before transcription analysis.
- If `dil_recorded: false`, the recording is transcribed and the raw audio is deleted after transcript verification.
- Raw audio retention is a configurable policy, not hardcoded.

### Telemetry / self-audit

Each stage writes a `StageLog` record:

```ts
{
  stage: string;
  startedAt: string;
  completedAt: string | null;
  attempts: number;
  passed: boolean;
  findings: { check: string; passed: boolean; evidence: unknown }[];
  guard: { name: string; threshold: number; value: number; passed: boolean }[];
  status: "running" | "passed" | "failed" | "skipped";
}
```

## 4. File changes required

### API

1. `apps/api/src/lib/capture-pipeline.ts` — rewrite as `StagedCapturePipeline`
2. `apps/api/src/lib/stage-audit.ts` — new: generic stage runner + guard evaluator
3. `apps/api/src/lib/transcription-job.ts` — add confidence gate
4. `apps/api/src/lib/survey-job.ts` — already self-audits geometry; wrap in stage runner
5. `apps/api/src/lib/design-job.ts` — add SKU/material guard
6. `apps/api/src/lib/cost-job.ts` — add cost sanity guard
7. `apps/api/src/lib/audit-job.ts` — add blocking/advisory pass logic
8. `apps/api/src/lib/output-job.ts` — implement if missing (package outputs)
9. `apps/api/src/lib/pipeline-job.ts` — may already contain worker dispatch; route through staged runner
10. `apps/api/src/routes/recordings.ts` — start the staged pipeline after upload

### Contracts

11. `packages/contracts/src/schemas/voice-intent.ts` — ensure `dil_consent` and `confidence` are required
12. `packages/contracts/src/schemas/project.ts` — add `stage_logs` and `current_stage` fields

### Mobile

13. `apps/mobile/app/(app)/processing/[id].tsx` — replace manual "Send to canvas" with autonomous stage UI; show stage logs, confidence, guard failures
14. `apps/mobile/app/(app)/recording.tsx` — add DIL consent toggle and confidence preview

### Web

15. `apps/web/src/components/canvas/handoff/features/instantPlanner/HeroDetailOverlay.tsx` — already polished; later can load real catalog symbol 3D models
16. `apps/web/src/components/canvas/handoff/features/assetPanel/*` — already fixed; optional: symbol-driven tile colours

### Tests

17. `apps/api/src/lib/capture-pipeline.test.ts` — new: stage sequence, guard failures, retries
18. `packages/contracts/src/schemas/voice-intent.test.ts` — new: contract validation
19. `apps/mobile/src/__tests__/processing.test.tsx` — optional: stage UI states

### Docs

20. `docs/STAGED-AUTONOMOUS-BUILD-PLAN.md` — this file
21. `docs/WORKSTREAM-STATUS.md` — update after build
22. `docs/GAP-ANALYSIS-CURRENT.md` — mark closed items

## 5. Implementation order

1. **Foundation** — contracts, store schema, `StageLog`, `stage-audit.ts`
2. **Pipeline** — rewrite `capture-pipeline.ts` to run `transcription` → `survey` → `design` → `costing` → `audit` → `outputs`
3. **Mobile** — update processing screen to consume stage logs and remove manual gate
4. **Voice quality** — fill `confidence`, enforce `dil_consent`, wire voice intent directly inside design stage
5. **Polish** — skeletons, view transitions, branded dialog for undo, type scale
6. **Tests** — stage runner tests, guard tests, mobile UI states
7. **CI gate** — `pnpm run ci` green

## 6. Verification

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm run ci`
- Manual: upload recording, watch phases run end-to-end without manual "Send to canvas"
