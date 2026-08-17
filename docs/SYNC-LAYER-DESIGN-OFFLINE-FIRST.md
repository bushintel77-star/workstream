# Sync layer — offline-first design (Stage 2, handheld)

Status: `design — not yet implemented`
Audited: 2026-08-17 (mobile screens vs Stage 2 rail)

## 1. Audit — what the handheld does today

### 1.1 The mobile screens and their server writes

| Screen | Server write (via `WorkstreamClient`) | Entity | Offline-safe today? |
| ------ | ------------------------------------- | ------ | ------------------- |
| `confirm-pin` | `createProject` | project | ❌ — requires connectivity |
| `recording` | `uploadRecording` (audio m4a) | recording + media | ❌ — media upload needs a live socket |
| `grid-soil` | `runDictation` | dictation → pipeline | ❌ — triggers a server pipeline |
| `measure-photo` | `measurePhoto` (image) | photo measurement | ❌ — image upload |
| `project/[id]` | `createOverride`, `runSurvey` | survey override / survey | ❌ |
| `design-studio/[id]` | `saveDesignCanvas` | design canvas | ❌ — full-doc PUT |
| `filing/[id]` | `createProjectFile` (docs) | project file + media | ❌ |

Every one of these is a **direct, blocking HTTP call** through `WorkstreamClient`
(`packages/client/src/index.ts`). There is no offline path: a lost connection
means the capture is lost or the UI errors.

### 1.2 What already exists

- **`apps/mobile/src/hooks/useOfflineQueue.ts`** — a minimal AsyncStorage
  FIFO (`cacheKey`/`queueKey` per project, `enqueue`/`flushQueue`). **Dead code:
  nothing imports it.** No idempotency, no retry/backoff, no ack-per-op, no
  conflict resolution, no network detection.
- **Storage:** `@react-native-async-storage/async-storage` only. No SQLite /
  WatermelonDB / Realm / expo-file-system / NetInfo installed.
- **Client:** `WorkstreamClient` is a thin fetch wrapper — no offline queue,
  no optimistic writes, no idempotency keys.

### 1.3 Gap vs Stage 2

Stage 2 rail: *mobile gate (EAS build + capture→sync smoke)*; acceptance:
**"offline capture syncs to the desktop."**

Current state: **screens exist, sync does not.** The capture screens can't be
used offline at all. The design below is the missing layer.

## 2. Design principles

1. **Capture is never lost.** Every field action lands in the local store
   first (optimistic), then syncs. The UI never depends on connectivity.
2. **Idempotent by construction.** Every outbox op carries a client-generated
   id; replaying it is safe (server upserts keyed on that id).
3. **Conflict-free by design where possible.** Client-generated UUIDs mean no
   key collisions; per-entity merge rules below handle the rest.
4. **Honest status.** The UI shows queued / syncing / failed / conflict, and
   the traceability rule extends to capture provenance (a synced figure
   records which device + when it was captured).

## 3. Local store (AsyncStorage schema)

Keyed by `ownerId` so a signed-out device can't leak another user's data.

```
ws:<ownerId>:meta            { schema_version, last_sync_at, device_id }
ws:<ownerId>:project:<id>    Project            (draft fields + status)
ws:<ownerId>:recording:<id>  RecordingMeta      { id, project_id, uri, duration_s, mime, consent, created_at }
ws:<ownerId>:measurement:<id> PhotoMeasurementMeta
ws:<ownerId>:canvas:<id>     DesignCanvasDraft  { placements, strokes, updated_at }
ws:<ownerId>:file:<id>       ProjectFileMeta    { id, project_id, kind, uri, title }
ws:<ownerId>:outbox          OutboxOp[]         (append-only, see §4)
ws:<ownerId>:outbox:<opId>   OutboxState        { status, attempt_count, last_error }
```

- **Media** (audio / photo / docs) is staged via `expo-file-system` (to be
  added) with the local URI recorded in the entity meta; the outbox op
  references the URI. The device file is only deleted after the upload acks.
- **Schema versioning:** `schema_version` gates migrations; a bump invalidates
  stale caches but never the outbox (outbox ops are replayable).

## 4. Outbox queue

Append-only op log, one entry per captured action:

```ts
type OutboxOp = {
  op_id: string;            // client UUID — the idempotency key
  entity: "project" | "recording" | "measurement" | "canvas" | "file" | "override" | "dictation";
  action: "create" | "update" | "delete" | "upload" | "trigger";
  entity_id: string;        // client-generated UUID (server upserts on it)
  project_id: string | null;
  payload: unknown;         // JSON-serializable body (media = local URI ref)
  media_uri?: string;       // staged file path when action === "upload"
  created_at: number;
  attempt_count: number;    // bumped on each drain attempt
  status: "queued" | "in_flight" | "failed" | "poisoned";
};
```

Rules:
- **Append-only** — ops are never mutated in place; a failed op is retried,
  and after `MAX_ATTEMPTS` (default 5, with backoff) it is **quarantined as
  `poisoned`** and surfaced in the UI, never silently dropped.
- **Ordering** — FIFO per entity (a canvas update must follow its create).
  Cross-entity ordering is best-effort (project create before its recordings).
- **Idempotency** — the server keys on `entity_id`/`op_id`; a retry after a
  timeout that actually succeeded is safe (server returns the existing row).

## 5. Conflict resolution

Per-entity strategy, chosen to avoid "last write silently wins" on the canvas:

| Entity | Strategy |
| ------ | -------- |
| `project` | **Last-write-wins** on draft fields, keyed by client UUID. Server `updated_at` stamp; the newer `updated_at` wins. |
| `canvas` | **Set-union per id-addressed array.** `placements` and `strokes` are object arrays keyed by id → merge = union by id, newest `updated_at` per element. Deletes carry tombstones so a removed placement doesn't resurrect on the other device. No whole-doc overwrite. |
| `recording` / `measurement` / `file` | **Create-once.** Client UUID ⇒ no key conflict; upload is idempotent (server stores the media once, returns existing on re-upload). |
| `override` / survey notes | **Operation-log replay** (additive). Each override is a separate op; the server appends, never replaces the log. |
| `dictation` / `runSurvey` / `runPipeline` | **Trigger-once.** Keyed by a client `run_id`; the server dedupes so a retried trigger doesn't double-run the pipeline. |

**Tie-break rule:** when two devices edit the same field with the same
`updated_at`, the lexicographically larger `device_id` wins (deterministic,
documented — no randomness).

## 6. Sync engine

```
┌──────────────┐   ┌──────────────────────┐   ┌──────────────────┐
│ Capture flow │ → │ writeThrough()        │ → │ Local store      │
│ (screens)    │   │ optimistic write +    │   │ (AsyncStorage)   │
└──────────────┘   │ enqueue outbox op     │   └────────┬─────────┘
                   └──────────────────────┘            │
                                                        ▼
┌──────────────┐   ┌──────────────────────┐   ┌──────────────────┐
│ UI status    │ ← │ SyncEngine.drain()    │ ← │ reachability     │
│ (queued/     │   │ FIFO + retry/backoff  │   │ probe (NetInfo)  │
│ syncing/     │   │ ack → remove op       │   └──────────────────┘
│ failed/      │   │ poison → quarantine   │
│ conflict)    │   └──────────────────────┘
└──────────────┘
```

- **Reachability:** `@react-native-community/netinfo` (to be added) drives
  drain scheduling; a lightweight `GET /healthz` probe confirms the API is
  reachable before draining (NetInfo "online" ≠ server reachable).
- **Drain:** FIFO, one op at a time. On success → ack (remove op + delete
  staged media). On network failure → exponential backoff (`500ms × 2^n`,
  capped 30s). On server 4xx → quarantine as `poisoned` (a schema bug must not
  block the whole queue).
- **Media uploads:** chunked/resumable via `expo-file-system` upload task;
  the outbox op stays `in_flight` until the final ack.
- **Sync triggers:** app foreground, NetInfo reconnect, pull-to-refresh, and a
  periodic timer (15 min). A manual "Sync now" button is always available.
- **Pull direction:** the handheld is primarily a *writer*; the desktop reads
  its own DB. Pull (server → device) is limited to project status + approved
  assets so the device can reflect outcomes without a full mirror.

## 7. Wiring plan (implementation order)

1. **Add deps:** `@react-native-community/netinfo`, `expo-file-system`.
2. **`packages/mobile-sync`** (new shared package, or `apps/mobile/src/sync/`):
   - `localStore.ts` — AsyncStorage schema (§3) with migrations.
   - `outbox.ts` — append/ack/poison/backoff (§4).
   - `conflicts.ts` — per-entity merge rules (§5), pure + unit-tested.
   - `syncEngine.ts` — reachability + drain loop (§6).
   - `writeThrough.ts` — the single wrapper the screens call instead of raw
     client methods: optimistic local write + enqueue + background drain.
3. **Replace dead `useOfflineQueue.ts`** with the engine (or delete it).
4. **Convert the 7 capture screens** (§1.1) from direct `api.*` calls to
   `writeThrough(...)`.
5. **Server idempotency:** add `op_id`/`entity_id` dedupe to the relevant
   routes (`projects`, `recordings`, `measurements`, `files`, `overrides`,
   `canvas`, pipeline triggers).
6. **Mobile gate (CI):** EAS build + a `capture→sync` smoke — seed the local
   store, mock offline, drain, assert the server received every op exactly
   once (idempotency check).

## 8. Acceptance criteria (Stage 2 gate)

- A field capture (voice / photo / survey note / canvas edit) made with the
  network off is visible locally and **syncs to the desktop** when back
  online — nothing lost.
- Replaying the same outbox op (timeout retry) does **not** duplicate rows or
  media.
- Two devices editing the same canvas converge (set-union + tombstones); the
  tie-break is deterministic.
- A poisoned op is surfaced (not silently dropped) and the rest of the queue
  keeps draining.
- Capture provenance (device + timestamp) is recorded on synced figures for
  the ground-truth audit.
