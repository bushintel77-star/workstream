# AGENTS.md

Guidance for cloud agents working in the Workstream monorepo.

## Cursor Cloud specific instructions

### Services (local dev)

| Service | Command | URL |
|---------|---------|-----|
| API | `pnpm --filter @workstream/api dev` | http://localhost:3001 |
| Web | `pnpm --filter @workstream/web dev` | http://localhost:3002 |
| Both | `pnpm dev` (Turbo; builds workspace packages first) | |

Copy env templates before first run: `apps/api/.env.example` → `.env`, `apps/web/.env.example` → `.env`. Without Clerk keys the stack runs as `dev-user`.

### First-time build

After `pnpm install`, build workspace packages once:

```bash
pnpm --filter '@workstream/*' build
```

Turbo `dev` also triggers dependency builds, but a manual build avoids cold-start surprises.

### Lint / test

See root `package.json`: `pnpm typecheck`, `pnpm test`, `pnpm lint`. Pre-commit runs `lint-staged` → workspace `typecheck` on staged TS.

### Canvas app entry points

- Home (address composer): `/`
- Single canvas surface: `/projects/[id]?mode=survey|sketch|cad|quote|share`

Legacy `/design/studio` routes redirect into canvas modes.

### Dev-server encoding gotcha

Some source files historically contained Windows-1252 punctuation (em dash `0x97`, middle dot `0xb7`, etc.). **Next.js Turbopack requires valid UTF-8** and will 500 on import if a file has lone high bytes. If the web dev server fails with `invalid utf-8 sequence`, scan the reported file and replace non-UTF-8 punctuation with ASCII or proper UTF-8 characters. Do **not** bulk-replace across the whole repo with sed — fix only the files Turbopack names.

### Demo project (empty store)

```bash
curl -s -X POST http://localhost:3001/projects \
  -H 'Content-Type: application/json' \
  -d '{"address":"12 Wrights Terrace, South Yarra VIC 3141","lat":-37.838,"lng":144.992}'
# then POST /projects/:id/survey with {}
```

Open `/projects/:id?mode=survey` to exercise the aerial canvas and right-rail chrome.
