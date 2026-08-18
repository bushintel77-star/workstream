# Workstream handover

> **Superseded — historical record (2026-08-11).** The pipeline-dock
> workflow and the `3383ae0` state it describes have moved on. Current
> entry: [`ONBOARDING.md`](ONBOARDING.md); live tracker: `OUTSTANDING.md`;
> current handover: `docs/SESSION-HANDOVER-2026-08-18-CONTINUATION.md`.

Updated: 2026-08-11
Branch: `main`

This file is the quick-start handover for a fresh context. The authoritative in-flight roadmap is the pipeline dock:

- `.pipeline/dock/manifest.json`
- `docs/STAGED-AUTONOMOUS-BUILD-PLAN.md` — autonomous capture/WIP/GAP roadmap
- `docs/VOICE-FIRST-ENGINEERING-BRIEF.md` — third-party voice architecture and mockup brief
- `OUTSTANDING.md` — production punch list

## Current shipped state

Latest main commit: `3383ae0` — server-backed voice intent classification, Whisper-derived STT confidence, polygon clipping, studio view transitions, and a dedicated Garden focus mode.

The latest follow-up documentation commit is `1903e69`.

Railway production:

- Web: `https://web-production-3c194.up.railway.app`
- API: `https://api-production-a8ff1.up.railway.app`
- API durability volume: `api-volume` mounted at `/repo/apps/api/data`

Voice-first foundation currently shipped:

```text
mobile recording
  → batch upload
  → transcription (Whisper verbose_json confidence)
  → explicit or staged processing
  → server-backed voice intent classification
      ├─ design language → existing /design/assist → ephemeral ghosts
      └─ operational language → existing /dictation → tasks/spatial ledger
  → lexical fallback when provider is unavailable
```

Mobile recording has microphone permissions, low-quality mono audio, metering, heuristic VAD, ambient/clipping detection, pause/resume, upload, and processing states.

Shared voice contracts and routing live in:

- `packages/contracts/src/schemas/voice-intent.ts`
- `packages/domain/src/voice-intent.ts`
- `packages/client/src/index.ts` → `classifyVoiceIntent()` and `submitVoiceIntent()`
- `apps/api/src/routes/voice-intent.ts` → `POST /projects/:id/voice-intent/classify`
- `apps/api/src/lib/voice-intent.ts` → Anthropic classifier with lexical fallback
- `apps/api/src/lib/transcribe.ts` → Whisper `verbose_json` confidence

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
- 260 test files passed.
- 1,550 tests passed.
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

- ~~Replace heuristic STT confidence with provider/on-device confidence when available.~~ Done.
- ~~Server-backed voice intent classification.~~ Done.
- ~~Polygon clipping for title-minus-house geometry.~~ Done.
- ~~Garden focus studio mode (title-minus-house clipping, view transition, and dwelling ghosting).~~ Done.
- Streaming/on-device transcription spike (`whisper.rn` versus OS speech recognition).
- Silero VAD benchmark against Melbourne site recordings.
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

1. ~~Polygon clipping for title-minus-house geometry~~ Done.
2. ~~View transition wiring~~ Done.
3. ~~Garden focus studio mode~~ Done.
4. Survey utility ingestion: extend the survey stage to accept BYDA / council utility data and store it as `utility_segments` linked to the title polygon.
