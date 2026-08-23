# Workstream consolidation (Curtis & Co Construct → Workstream)

## One project, two public names

| Layer | Name | Where it appears |
|-------|------|------------------|
| **Studio** | Curtis & Co | Client quotes, brochures, letterhead, portal copy |
| **Product** | **Workstream** | App UI, API, mobile, GitHub, Railway services |

**Construct** and **Walkthrough** are retired product codenames. Do not use them in new UI, env vars, or service names.

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

GitHub: https://github.com/Boringuy7799/workstream (canonical origin).

## Railway (canonical deploy)

| Service | URL |
|---------|-----|
| API | https://api-production-a8ff1.up.railway.app |
| Web | https://web-production-3c194.up.railway.app |
| Volume | `api-volume` mounts at `/repo/apps/api/data` |

Fly.io configs have been removed. Railway deploys automatically on push to `main`.

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
