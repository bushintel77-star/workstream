# Workstream consolidation (Curtis & Co Construct → Workstream)

## One project, two public names

| Layer | Name | Where it appears |
|-------|------|------------------|
| **Studio** | Curtis & Co | Client quotes, brochures, letterhead, portal copy |
| **Product** | **Workstream** | App UI, API, mobile, GitHub, Fly apps |

**Construct** and **Walkthrough** are retired product codenames. Do not use them in new UI, env vars, or Fly app names.

## Canonical folder

```
C:\Users\Tim\Downloads\CURTIS-CO\
  README.md
  workstream\          ← monorepo (this codebase)
  clients\             ← per-job files (e.g. wrights-terrace)
```

`KellyBet-Fresh\WorkSteam` was a duplicate checkout. **Open `CURTIS-CO\workstream` in Cursor** (or sync changes there) and delete the KellyBet copy when no editor has it open.

GitHub: https://github.com/Boringuy7799/workstream (repo `construct` redirects here).

## Fly.io (new names)

| Legacy (still running) | Workstream target |
|------------------------|-------------------|
| `construct-api` | `workstream-api` → https://workstream-api.fly.dev |
| `construct-web` | `workstream-web` → https://workstream-web.fly.dev |
| volume `construct_data_v2` | `workstream_data` (create new volume on cutover) |

**Production today** deploys to **construct-api** / **construct-web** (see `apps/*/fly.toml` and `scripts/deploy-fly.ps1`). Renaming Fly apps to `workstream-*` is optional cutover — do not run both pairs.

## Env vars (renamed, backward compatible)

| Workstream (set these) | Legacy (still read) |
|------------------------|---------------------|
| `WORKSTREAM_PORTAL_SECRET` | `CONSTRUCT_PORTAL_SECRET` |
| `WORKSTREAM_PERSIST_PATH` | `CONSTRUCT_PERSIST_PATH` |

## Mobile bundle ID

| Legacy | Workstream |
|--------|------------|
| `com.curtisandco.construct` | `com.curtisandco.workstream` |

New App Store / Play listing required when you change bundle IDs.

## MYOB SKU links

JSON field renamed: `construct_sku` → `rate_card_sku`. Old snapshots are migrated on load.
