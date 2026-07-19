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
- **Fit sheet** (cream paper working drawing): `ArchitecturalSheet` + `FitSheetLayer` + MapLibre `GeoSiteMap` on the Vicmap title frame. Survey → lock title → **Open Fit sheet** (or auto on CAD/Quote/Share). Toggle with **F** / `data-testid="fit-sheet-top"`. Session prefs: `ws-fit-sheet:{projectId}`, `ws-fit-dims:{projectId}`.

Sketch mode (`SketchInstrument`) owns: paint/save, AI ghost scan (`scanDesignGhostsAction`), NL assist (`designAssistAction` + ribbon Ask AI), Cmd+K command palette, rotate/scale handles, ribbon search, site-intelligence overlays (sun/shade + easements toggles on right rail when on static-aerial fallback).

**Design Studio v4 handoff** (reference only — not production code): `docs/design/operator-redesign/design_handoff_landscape_cad_studio/`. Operator chrome is implemented in `CanvasStudioHeader` + v4 tokens in `apps/web/src/styles/globals.css`. Prototype `.dc.html` is pixel spec; do not port verbatim.

MapLibre stage needs map style routes (`/api/map-config`, `/api/map-style/satellite`) — works without keys via bundled fallbacks where configured.

AI pipeline: heuristic coaching (`buildSketchCanvasAiSuggestions`) + optional vision ghosts API + NL sketch assist (`POST /projects/:id/design/assist` via `buildStudioSystemPrompt`) + CAD ghosts on generate (`generateCadAction`). Ghosts are ephemeral until accept.

**Single branch:** Fit sheet geo canvas and sketch-assist polish both live on `main` — do not reintroduce parallel feature branches for canvas chrome.

### UTF-8 / Turbopack

Next.js dev requires valid UTF-8 in imported TS files. Lone Windows-1252 bytes (e.g. `0x97` em dash) cause 500s. Fix only files Turbopack names — do not bulk sed the repo.
