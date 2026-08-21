# FieldLoop v0.1 — Offline Sync Contract

WatermelonDB keeps a local SQLite mirror. Supabase Postgres is the system of
record. This contract defines how the two reconcile when a device comes back
online.

## 1. Identity & shared keys

- Every row shares the same `id` (UUID) on client and server. The client may
  mint a UUID offline (e.g. `uuid.v4()`); the server accepts client ids.
- `updated_at` is epoch **milliseconds** on the client (WatermelonDB) and
  `TIMESTAMPTZ` on the server. The API converts between the two.

## 2. Sync metadata on every synced table

Every synced row carries:

| Field | Meaning |
|-------|---------|
| `id` | Shared UUID primary key |
| `updated_at` | Last-write timestamp (ms) |
| `deleted_at` | Soft-delete tombstone (ms), null when live |
| `version` | Monotonic optimistic-concurrency counter (financial tables) |

Soft deletes are used everywhere; rows are never hard-deleted from a synced
table. WatermelonDB's `markAsDeleted` sets `_status = 'deleted'`; the push
converts that to `deleted_at = now()` on the server.

## 3. Pull (server → client)

`GET /sync/pull?cursor=<lastPulledAt>&entity=<entityId>`

- Returns all rows for the caller's entity with `updated_at > cursor`.
- Includes tombstones (`deleted_at` set) so the client removes local rows.
- The cursor is the max `updated_at` the client has seen; the server returns
  `{ changes, nextCursor, serverTime }`.

## 4. Push (client → server)

`POST /sync/push` with the WatermelonDB changes payload (`created`, `updated`,
`deleted`).

- The server applies changes within the caller's RLS scope and returns a list
  of records that were **rejected or conflicted** for the client to resolve.
- Duplicate pushes are idempotent (same `id` + `version`).

## 5. Conflict resolution

- **Field capture (client-authoritative):** photos, signatures, JSA responses,
  hazard logs, voice notes. Client `updated_at` wins; last-write-wins.
- **Financial fields (server-authoritative):** `total_inc_gst`, `subtotal`,
  invoice numbers, quote totals. The server recomputes these on push and may
  overwrite the client value; the client pulls the corrected value back.
- **Optimistic concurrency:** financial tables use `version`. A push whose
  `version` is behind the server's is rejected with the server's current row so
  the client can rebase.

## 6. Photo upload (R2)

- Offline, photos are stored at a local file path in `photos.r2_key`.
- On reconnect, the client requests an R2 **presigned upload URL** from the API,
  uploads the bytes, then pushes the `photos` row with the final `r2_key` and
  `content_hash` (SHA-256). `content_hash` deduplicates and powers the
  Dispute-Shield evidence set.

## 7. Action queue semantics

Offline mutations (status changes, referrals, lodge requests) are recorded as
local WatermelonDB rows; on reconnect they push in the normal order. The server
side additionally writes `sync_outbox` rows for anything that must fan out
asynchronously (Slack broadcasts, accounting pushes), so a sync ack does not
block a third-party webhook.

## 8. Ordering & idempotency

- Push order: entities → jobs → dependent rows (line items, photos, etc.), so
  foreign keys resolve.
- Webhooks/accounting pushes are triggered **after** the DB transaction commits
  and are recorded in `sync_outbox` with retry (`attempts`) — at-least-once with
  idempotent consumers (invoice number uniqueness, Slack dedup key).
