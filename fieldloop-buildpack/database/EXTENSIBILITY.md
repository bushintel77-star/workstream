# FieldLoop v0.1 — Database Extensibility & Partitioning

How the database supports the app expanding into **any field** (new trades,
divisions, or domains) without core rewrites.

## 1. Three mechanisms, three jobs

| Mechanism | Job | What it is NOT |
|-----------|-----|----------------|
| **Extensible schema (modules)** | Lets the app expand into any new field/domain | Not partitioning — this is application architecture |
| **Postgres partitioning** | Scales / isolates storage per tenant when volume demands | Not an expansion mechanism — invisible to the app |
| **MCP server / plugins** | Lets AI agents and tools act on the system with typed, RLS-scoped capabilities | Not a database at all — an access layer in front of the API |

Expansion into a new field is a **module problem**. Partitioning and MCP are
supporting layers, not the expansion mechanism.

## 2. Extensible core (already in place)

- `entities` / `entity_members` — a new division is a **new row**, zero schema
  change.
- `jobs` carries JSONB (`body_corp_meta`, `insurance_meta`) and enums; genuinely
  flexible metadata needs no migration.
- Rule: domain-specific fields belong in **module tables keyed to `jobs`**,
  never sprayed onto `jobs`.

## 3. Module pattern — how any new field joins

A new domain (electrical, fire, pool safety, landscaping…) is **one module**:

1. `packages/contracts` — Zod schemas for the module.
2. Extension tables (FK → `jobs`) + RLS policy (existing join pattern) +
   WatermelonDB schema entry + `sync_outbox` hooks.
3. UI screens per the design system; compliance/accounting/Slack hooks if the
   domain needs them.
4. A **module manifest** entry (tables, contracts, MCP tools) — the registry the
   app, sync layer, and MCP server read. A module is *declared*, not hand-wired.
5. Pack version bump + verification gate.

Core (`jobs`, `entities`, auth, sync, compliance engine) is untouched by any
module.

## 4. Partitioning — when, not if

- v0.1 ships **unpartitioned**: RLS already provides tenant isolation.
  Partitions are a storage/scaling strategy and must never change behaviour.
- When tenant volume makes latency or maintenance a concern (e.g. tens of
  millions of rows on `jobs` / `photos` / `job_line_items`), add **LIST
  partitioning on `entity_id`** — the partition key aligns with the RLS policy,
  so the two compose cleanly.
- Migration path: new partitioned table + backfill, or `CREATE TABLE …
  PARTITION BY LIST (entity_id)` with per-entity partitions created up front for
  new tenants.
- Cross-tenant analytics belong in a separate reporting store, not in partitions.

## 5. Expansion checklist

New field = ~1 module: 2–4 extension tables, 1 contracts file, 1 manifest entry,
1 RLS policy, WatermelonDB entries, screens, MCP tool definitions. No core
changes, no `jobs` migration.
