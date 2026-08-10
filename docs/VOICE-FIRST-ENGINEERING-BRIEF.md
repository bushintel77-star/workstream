# Workstream voice-first integration brief

## Purpose

This brief is for a third-party engineer producing interaction mockups and a small technical prototype for Workstream's voice-first canvas integration.

The goal is not to create a voice chatbot. Voice is an additional input channel into the existing landscape-design canvas, domain rules, AI assist, and human-in-the-loop ghost workflow.

## Product context

Workstream is a Melbourne landscape design and build co-pilot. The primary product surface is the operator canvas:

- Survey — site and cadastral context.
- Sketch — freehand and structured drawing.
- CAD — indicative landscape geometry and placement.
- Elevation — accepted placement profiles.
- Quote — live costing and supplier context.
- Share — client-facing output.

The canvas is the source of truth. Voice must not replace it or create a parallel transcript-first workflow.

## Implementation reality versus target architecture

The report describes the desired end state. The current repository is intentionally one step earlier in several areas; mockups must distinguish shipped behaviour from prototype concepts.

| Area | Current repository | Target prototype / future phase |
|---|---|---|
| Audio transport | Batch file upload via `POST /recordings` | Push-to-talk or streaming chunks for low-latency turns |
| Transcription | Server-side asynchronous transcription after upload | Interim partials plus final turns with endpointing |
| Intent routing | Conservative client-side lexical seam in `submitVoiceIntent()` | Shared/server-backed classifier using board context and confidence |
| Design action | Existing `/design/assist` produces ephemeral ghosts | Voice turn should show anchored ghost plus constraints and Accept/Refine/Undo |
| Mobile design result | Processing screen offers `Send transcript to canvas` and shows acknowledgement | Mobile canvas/result surface should display the proposed geometry directly |
| Operational action | Existing `/dictation` creates tasks and spatial ledger entries | Keep this path separate from design geometry |
| Confidence | Contract field exists; current recording hand-off does not yet populate model confidence | Drive visible confidence and fallback states |
| DIL | Explicitly disabled (`dil_recorded: false`) | Consent, retention, deletion, and auditable preferences before any analysis |
| Audio retention | Uploaded recordings are currently persisted for the capture pipeline | A future privacy mode may destroy raw audio after verified transcription; do not claim this is shipped |
| BIM/IFC | Not currently integrated | Separate interoperability phase; do not make IFC a dependency of the first voice prototype |

The latency figures in the report are design targets, not current measurements. The current batch flow should be measured before a streaming transport is selected.

### Mobile

The mobile recording surface is at:

`apps/mobile/app/(app)/recording.tsx`

It currently provides:

- Microphone permission request.
- Low-quality mono recording preset to keep uploads lean.
- Start, pause, resume, stop, and discard controls.
- Recording timer.
- Live audio metering waveform.
- Voice / silent / ambient classification.
- Clipping detection.
- Haptic feedback.
- Upload of the audio file and duration.

The mobile processing surface is at:

`apps/mobile/app/(app)/processing/[id].tsx`

It polls transcription, survey, design, costing, and audit progress. It now also exposes:

- `Send transcript to canvas` after transcription completes.
- A lightweight result message.
- Design-language routing to canvas assist.
- Operational-language routing to Grid & Soil dictation.

This is intentionally an explicit action. A long site-walk transcript is not automatically sent to the design model.

### Desktop web

The desktop canvas is mounted by:

`apps/web/src/components/canvas/handoff/HandoffDesignStudio.tsx`

Existing AI interaction surfaces include:

- Header `Ask AI` affordance.
- Cmd+K command palette.
- Summoned `StudioAssistPanel`.
- Ephemeral placement ghosts.
- `assistReply` acknowledgement state.
- Existing accept / reject / undo patterns.
- Board context containing site, geometry, constraints, findings, sustainability, and commercial context.

Voice mockups should use these surfaces rather than introduce a permanent chat rail.

## Current backend connections

### Audio upload

Mobile uses the shared client:

`packages/client/src/index.ts` → `uploadRecording()`

The API endpoint is:

```http
POST /projects/:projectId/recordings
Content-Type: multipart/form-data
```

The upload includes:

- Audio file.
- `duration_s`.

The API route is:

`apps/api/src/routes/recordings.ts`

The server stores the recording and starts the capture pipeline asynchronously.

### Capture pipeline

`apps/api/src/lib/capture-pipeline.ts`

Current flow:

```text
recording upload
  → transcription
  → survey
  → survey_review
```

The transcription worker is:

`apps/api/src/lib/transcription-job.ts`

Recording records are persisted and exposed through:

```http
GET /projects/:projectId/recordings
```

### Operational dictation

The existing operational voice path is:

```http
POST /projects/:projectId/dictation
```

The route is:

`apps/api/src/routes/dictation.ts`

The implementation is:

`apps/api/src/lib/dictation.ts`

It uses the Grid & Soil system prompt and tool calls to create:

- Crew tasks.
- Spatial ledger entries.

This path is appropriate for speech such as:

> “Sam, check the western trench before the rain.”

or:

> “Log 18 square metres of bluestone for the pool surround.”

### Design assist

The existing canvas AI route is:

```http
POST /projects/:projectId/design/assist
```

The route is:

`apps/api/src/routes/design-assist.ts`

It loads the full board context and calls `runStudioAssist()` in:

`apps/api/src/lib/claude.ts`

The request is currently:

```json
{
  "message": "Create a 2.4 metre bluestone path along the north boundary"
}
```

The response contains:

- `reply` — concise acknowledgement or clarification.
- `suggestions` — ephemeral placement ghosts.

The response does not directly commit geometry. Human acceptance remains mandatory.

## Shared voice-intent contract

The current shared contract is:

`packages/contracts/src/schemas/voice-intent.ts`

```ts
{
  transcript: string;
  confidence?: number;
  source: "mobile_recording" | "push_to_talk" | "typed";
  dil_consent: boolean;
}
```

The client router is:

`packages/client/src/index.ts` → `submitVoiceIntent()`

Current routing logic:

```text
spoken transcript
  ├─ design language → POST /design/assist
  └─ operational language → POST /dictation
```

The classifier is currently conservative and lexical. It is a routing seam for the next model-backed intent classifier, not the final natural-language understanding layer.

## Recommended voice interaction model

### Core loop

```text
Capture
  → Transcribe
  → Show confidence / transcript
  → Classify intent
  → Resolve site and design constraints
  → Produce ghost, clarification, or operational event
  → Human accepts, refines, or undoes
```

### Design request example

Input:

> “Create a 2.4 metre wide bluestone path from the existing gate to the rear terrace, 300 millimetres off the fence.”

Expected result:

1. Show a short transcript or intent acknowledgement.
2. Resolve `existing gate`, `rear terrace`, fence, and boundary from board context.
3. Generate an ephemeral path ghost.
4. Show constraint annotations:
   - Width: 2.4 m.
   - Setback: 300 mm.
   - Material: bluestone.
5. Present `Accept`, `Refine`, and `Undo`.
6. If the endpoints cannot be resolved, ask one short question:

> “Which gate — the west or north gate?”

### Operational request example

Input:

> “Sam, check the western trench before the rain.”

Expected result:

1. Keep the design canvas unchanged.
2. Create a task through the dictation tool path.
3. Show a concise acknowledgement and task status.
4. Do not expose a large transcript panel.

## Mobile mockup requirements

Produce mockups for these states:

### 1. Ready

- Primary microphone action.
- Project/site identity.
- Clear permission and privacy entry point.
- No forced voice-only mode.

### 2. Listening

- Large, obvious push-to-talk / recording affordance.
- Live level indication.
- `Listening` state.
- Pause and cancel.
- Small live transcript caption.
- Ambient-noise warning without blocking the user.

### 3. Processing

- `Transcribing` and `Understanding site instruction` states.
- Confidence indicator.
- No fake progress percentage.
- Ability to cancel or return to the project.

### 4. Design proposal

- One-sentence acknowledgement.
- Small transcript disclosure.
- Ghost summary.
- `View on canvas`, `Accept`, `Refine`, `Undo`.
- Constraint values visible in compact form.

### 5. Clarification

- One question only.
- Large answer targets.
- Voice answer and touch answer both supported.
- Preserve the original intent while asking the question.

### 6. Fallback

- Speech recognition failure.
- Low confidence.
- Noisy environment.
- Offline / upload retry.
- Clear fallback to typed instruction or manual canvas editing.

## Desktop mockup requirements

Do not design a permanent voice dashboard or chatbot transcript column.

Use the existing disappearing-chrome language:

```text
Idle canvas
  → microphone affordance summoned from header / Cmd+K
  → compact listening dock in frame chrome
  → ghost or clarification appears near the relevant canvas context
  → dock recedes after acceptance or dismissal
```

Desktop states to mock:

- Header microphone idle state.
- Listening dock with live transcript.
- Processing state.
- Clarification anchored to the relevant object or region.
- Ghost review with accept / refine / undo.
- Operational acknowledgement that does not cover the plan.

The camera and drawing plane must remain interactive. Voice chrome belongs in the frame or a summoned dock, not as a fixed opaque bar on the drawing.

## Voice-first mode behaviour

Voice-first should be a temporary interaction state, not a separate product mode.

The visual difference should be limited to:

- Active listening indicator.
- Transcript caption.
- Confidence / ambient status.
- Contextual ghost or clarification.
- Light confirmation state.

The following must not happen:

- Do not replace the canvas with a chat transcript.
- Do not lock the user into voice-only operation.
- Do not auto-accept geometry.
- Do not fabricate site or survey facts.
- Do not show a long spoken response.
- Do not analyse tone or personality without explicit consent.
- Do not claim live supplier availability when the source is canned or absent.

## Dynamic Interface Learning (DIL)

DIL is not currently active. The contract explicitly returns:

```ts
dil_recorded: false
```

A future DIL implementation must include:

- Explicit, revocable consent.
- Clear value proposition.
- Raw audio destruction after processing.
- Auditable retention behaviour.
- No advertising or resale use.
- A visible privacy state in the mobile voice surface.

Do not mock a hidden “mood detection” feature as if it exists today.

## First prototype recommendation

For the third-party prototype, build only these two flows:

1. Mobile: constrained landscape instruction → transcript → design proposal → canvas ghost review.
2. Mobile: operational site instruction → dictation task / spatial ledger acknowledgement.

Use stubbed model responses if necessary, but preserve the real response shapes:

- Transcript.
- Confidence.
- Intent kind.
- Reply.
- Suggestions / ghost data.
- Operational events.
- Accept / reject / undo state.

The prototype should demonstrate the difference between **design intent** and **site operations**, while showing that both enter the same Workstream project context and remain subordinate to human control.

## Relevant source locations

- Mobile recorder: `apps/mobile/app/(app)/recording.tsx`
- Mobile processing: `apps/mobile/app/(app)/processing/[id].tsx`
- Mobile API hook: `apps/mobile/src/lib/api.ts`
- Shared client: `packages/client/src/index.ts`
- Voice contract: `packages/contracts/src/schemas/voice-intent.ts`
- Intent classifier: `packages/domain/src/voice-intent.ts`
- Dictation route: `apps/api/src/routes/dictation.ts`
- Dictation engine: `apps/api/src/lib/dictation.ts`
- Recording route: `apps/api/src/routes/recordings.ts`
- Capture pipeline: `apps/api/src/lib/capture-pipeline.ts`
- Design assist route: `apps/api/src/routes/design-assist.ts`
- Design assist model path: `apps/api/src/lib/claude.ts`
- Desktop canvas: `apps/web/src/components/canvas/handoff/HandoffDesignStudio.tsx`
- Desktop assist panel: `apps/web/src/components/canvas/handoff/features/instantPlanner/StudioAssistPanel.tsx`
