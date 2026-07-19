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
- Operator canvas: `/projects/[id]?mode=survey|sketch|cad|quote|share` — mounts `HandoffDesignStudio` (`%-coord` parchment board)
- **Fit sheet** (cream paper working drawing): handoff `FitSheetOverlay` + Vicmap title boundary. Survey → title boundary / lock icon → Fit sheet (or auto on CAD/Quote/Share). Toggle with **F** / `data-testid="fit-sheet-top"`. Session prefs: `ws-fit-sheet:{projectId}`, `ws-fit-dims:{projectId}`. No “Stage 1” labels in the UI — progressive disclosure via icon controls.

**Vicmap cadastral** (API): keyless DELWP GeoServer WFS at `opendata.maps.vic.gov.au` — `apps/api/src/lib/vicmap.ts` self-discovers property/building layers via GetCapabilities (no `VICMAP_ENABLED` / developer.vic.gov.au API key). MapLibre `GeoSiteMap` / `SiteCanvas` removed; Trace + Calibrate on the handoff board remains the offline fallback.

Sketch / CAD on the handoff board own: paint/save, AI ghost scan, NL assist, Cmd+K, title-boundary snap, Fit sheet dims.

**Design Studio v4/v5 handoff** (reference): `docs/design/operator-redesign/design_handoff_landscape_cad_studio/`. README checklist; progress in `IMPLEMENTATION-STATUS.md`.

AI pipeline: heuristic coaching (`buildSketchCanvasAiSuggestions`) + optional vision ghosts API + NL sketch assist (`POST /projects/:id/design/assist` via `buildStudioSystemPrompt`) + CAD ghosts on generate (`generateCadAction`). Ghosts are ephemeral until accept.

**Single branch:** Handoff studio + Vicmap WFS live on `main` — do not reintroduce parallel MapLibre geo-canvas branches.

### UTF-8 / Turbopack

Next.js dev requires valid UTF-8 in imported TS files. Lone Windows-1252 bytes (e.g. `0x97` em dash) cause 500s. Fix only files Turbopack names — do not bulk sed the repo.
