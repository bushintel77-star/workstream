# Workstream consolidation (Curtis & Co Construct → Workstream)

## One project, two public names

| Layer | Name | Where it appears |
|-------|------|------------------|
| **Studio** | Curtis & Co | Client quotes, brochures, letterhead, portal copy |
| **Product** | **Workstream** | App UI, API, mobile, GitHub, Fly apps |

**Construct** and **Walkthrough** are retired product codenames. Do not use them in new UI, env vars, or Fly app names.

**Aegis** is a separate product (commodities deal workspace). Do not merge it into this repo.

## Canonical folder (single checkout)

```
C:\Users\Tim\Downloads\CURTIS-CO\
  README.md              ← Curtis & Co workspace home
  workstream\            ← this monorepo (open in Cursor)
  clients\               ← per-job files (e.g. wrights-terrace)
```

| Path | Status |
|------|--------|
| `Downloads\CURTIS-CO\workstream` | **Canonical** — edit here |
| `Downloads\KellyBet-Fresh\WorkSteam` | **Retired duplicate** — do not develop here |

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
