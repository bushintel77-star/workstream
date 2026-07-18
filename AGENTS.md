# AGENTS.md

Guidance for cloud agents working in the Workstream monorepo.

## Cursor Cloud specific instructions

### Services (local dev)

| Service | Command | URL |
|---------|---------|-----|
| API | `pnpm --filter @workstream/api dev` | http://localhost:3001 |
| Web | `pnpm --filter @workstream/web dev` | http://localhost:3002 |
| Both | `pnpm dev` | |

Copy `apps/api/.env.example` and `apps/web/.env.example` to `.env` before first run. Without Clerk keys the stack uses `dev-user`.

After `pnpm install`, run `pnpm --filter '@workstream/*' build` once (Turbo `dev` also builds deps).

Lint/test: `pnpm typecheck`, `pnpm test`, `pnpm lint` — see root `package.json`.

### Canvas product surface

- Home: `/` — address composer + sites list
- Operator canvas: `/projects/[id]?mode=survey|sketch|cad|quote|share`

Sketch mode (`SketchInstrument`) owns: paint/save, AI ghost scan (`scanDesignGhostsAction`), NL assist (`designAssistAction` + ribbon Ask AI), Cmd+K command palette, rotate/scale handles, ribbon search, site-intelligence overlays (sun/shade + easements toggles on right rail).

AI pipeline: heuristic coaching (`buildSketchCanvasAiSuggestions`) + optional vision ghosts API + NL sketch assist (`POST /projects/:id/design/assist` via `buildStudioSystemPrompt`) + CAD ghosts on generate (`generateCadAction`). Ghosts are ephemeral until accept.

### UTF-8 / Turbopack

Next.js dev requires valid UTF-8 in imported TS files. Lone Windows-1252 bytes (e.g. `0x97` em dash) cause 500s. Fix only files Turbopack names — do not bulk sed the repo.
