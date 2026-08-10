# Workstream handover

Updated: 2026-08-11
Branch: `main`

This file is the quick-start handover for a fresh context. The authoritative in-flight roadmap is the pipeline dock:

- `.pipeline/dock/manifest.json`
- `docs/STAGED-AUTONOMOUS-BUILD-PLAN.md` — autonomous capture/WIP/GAP roadmap
- `docs/VOICE-FIRST-ENGINEERING-BRIEF.md` — third-party voice architecture and mockup brief
- `OUTSTANDING.md` — production punch list

## Current shipped state

Latest main commit: `b5e0b3f` — autonomous staged capture pipeline with self-audit and guard rails.

The latest follow-up documentation commit is `d010acc`.

Railway production:

- Web: `https://web-production-3c194.up.railway.app`
- API: `https://api-production-a8ff1.up.railway.app`
- API durability volume: `api-volume` mounted at `/repo/apps/api/data`

Voice-first foundation currently shipped:

```text
mobile recording
  → batch upload
  → transcription
  → explicit or staged processing
  → lexical voice intent seam
      ├─ design language → existing /design/assist → ephemeral ghosts
      └─ operational language → existing /dictation → tasks/spatial ledger
```

Mobile recording has microphone permissions, low-quality mono audio, metering, heuristic VAD, ambient/clipping detection, pause/resume, upload, and processing states.

Shared voice contracts and routing live in:

- `packages/contracts/src/schemas/voice-intent.ts`
- `packages/domain/src/voice-intent.ts`
- `packages/client/src/index.ts` → `submitVoiceIntent()`

Design geometry remains human-in-the-loop. Autonomous processing can advance survey/design proposal/costing/audit/output stages, but it must not silently commit geometry.

## Autonomous staged pipeline

`apps/api/src/lib/capture-pipeline.ts` now runs:

```text
transcription → survey → design → costing → audit → outputs → complete
```

Each phase uses `apps/api/src/lib/stage-audit.ts` for:

- Findings.
- Numeric guards.
- Retry with exponential backoff.
- Failure-specific project statuses.
- Fail-fast stage progression.

Mobile processing consumes the stage statuses and displays failed stages. The current stage evidence is returned by the pipeline runner; durable stage-log persistence and retry-from-last-good UX remain follow-up work in `docs/STAGED-AUTONOMOUS-BUILD-PLAN.md`.

## Verification already run

- `pnpm run ci` passed.
- 255 test files passed.
- 1,533 tests passed.
- Typecheck passed across API, web, mobile, client, contracts, DB, domain, CAD, and UI.
- Lint passed.
- Web production build passed.
- Bundle budget passed: approximately 6.61 MB total chunks / 5.96 MB JavaScript.
- Canvas chrome and contrast smoke tests passed.
- API live readiness passed on build `b5e0b3f`.

## Remaining work

Human/infrastructure gated:

- EAS init and Apple/Google credentials.
- Real supplier rate sheets and approved supplier integrations.
- GitHub branch protection.
- Single-instance/multi-region Railway decisions.
- Licensed title/search and BYDA utility data.

Technical follow-up:

- Durable stage logs and retry-from-last-good API/UI.
- Real STT confidence propagation.
- Server-backed voice intent classification.
- Streaming/on-device transcription spike (`whisper.rn` versus OS speech recognition).
- Silero VAD benchmark against Melbourne site recordings.
- Polygon clipping for title-minus-house geometry.
- Survey utility ingestion.
- EPD-backed plant carbon coefficients.
- Richer asset/search and presentation polish.

Explicitly deferred:

- Phase 6 AI assist.
- Brochure output.
- True survey-grade CAD/IFC/PostGIS.
- Multi-user realtime sync.

## Working rules

- Railway is the only production deploy target.
- Do not push or commit unrelated user changes without checking status.
- Do not commit generated `data/` outputs.
- Run `pnpm run ci` before calling a build complete.
- Canvas-risk changes require the relevant kept Playwright smoke to be executed.
- Do not auto-accept AI geometry.
- Do not claim Vicmap easements are underground utility clearance.
- Use CSS tokens and existing CameraChrome/FrameDrawer parenting patterns.
- Keep voice UI ephemeral; never add a permanent chatbot transcript column.

## Next recommended slice

Implement durable stage evidence and retry-from-last-good:

1. Add stage-log persistence to the project/pipeline record.
2. Add a project-scoped stage-log read endpoint.
3. Let mobile show the failed guard and evidence.
4. Add `Retry from last good` with idempotent stage restart.
5. Keep design geometry proposal/review separate from autonomous data processing.
