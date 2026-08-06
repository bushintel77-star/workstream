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

**Build order gotcha:** `apps/api` tests resolve `@workstream/domain` from its built
`dist`, not `src`. After editing `packages/domain`, run
`pnpm --filter @workstream/domain build` before `pnpm test`, or api specs will
pass/fail against stale domain code. (`pnpm typecheck` builds deps, so running it
first also refreshes `dist`.)

Continuous integration gate: `pnpm run ci` (installs frozen lockfile, checks mobile placeholders, portal edge runtime, handoff hex colors, then typecheck + lint + vitest).

### Canonical production (Railway)

| Service | URL |
|---------|-----|
| Web | https://web-production-3c194.up.railway.app |
| API | https://api-production-a8ff1.up.railway.app |

API durability today is the Railway volume `api-volume` → `/repo/apps/api/data`
(`CONSTRUCT_PERSIST_PATH=…/store.json`, `CONSTRUCT_SQLITE_PATH=…/store.sqlite3`).

### End of build (mandatory)

Do not call a change finished until the gate has actually run:

1. Typecheck green
2. Touched/new unit tests green
3. Any kept Playwright/smoke for the risk area **executed and passing** (authoring the file alone is not enough)
4. Commit/push when the user asked to ship — then confirm deploy/CI or live behaviour if live was in scope

A hung e2e or skipped live probe is a blocker. Binding detail: `.cursor/rules/end-of-build.mdc`.

### Canvas product surface

- Home: `/` — address composer + sites list
- Operator canvas: `/projects/[id]?mode=survey|sketch|cad|quote|share` — mounts `HandoffDesignStudio` (`%-coord` parchment board)
- **Fit sheet** (cream paper working drawing): handoff `FitSheetOverlay` + Vicmap title boundary. Survey → title boundary / lock icon → Fit sheet (or auto on CAD/Quote/Share). Toggle with **F** / `data-testid="fit-sheet-top"`. Session prefs: `ws-fit-sheet:{projectId}`, `ws-fit-dims:{projectId}`. No “Stage 1” labels in the UI — progressive disclosure via icon controls.

**Vicmap cadastral** (API): keyless DELWP GeoServer WFS at `opendata.maps.vic.gov.au` — `apps/api/src/lib/vicmap.ts` self-discovers property/building layers via GetCapabilities (no `VICMAP_ENABLED` / developer.vic.gov.au API key). MapLibre `GeoSiteMap` / `SiteCanvas` removed; Trace + Calibrate on the handoff board remains the offline fallback.

Sketch / CAD on the handoff board own: paint/save, AI ghost scan, NL assist, Cmd+K, title-boundary snap, Fit sheet dims, **Services ledger** (right lane — ticks/metrics/focus; replaces services opacity dial), **Auto trench…** (irrig/conduit/drainage dig paths from zones → `construction_trenches`, ghost until Accept; not BYDA assets).

**Site infrastructure honesty:** Vicmap easements ≠ underground assets. Dig needs BYDA (+ often council drainage). Survey 5/5 = digital minimum; full LA pack = `docs/SITE-INFRASTRUCTURE-AUTOMATED-LINKS.md` (title easement hydrate LIVE; KEYLESS washes include planning/bushfire/contour/flood/heritage; BYDA / council / survey / arbor / site chase list).

**Sticky boundary rail (Cursor-style):** Env + Services live meta flush to the right viewport edge — translucent, sticky until ×. Expand opens the same-seam right lane. See `docs/ENV-AND-SITE-META-STICKY.md`.

**Design Studio v4/v5 handoff** (reference): `docs/design/operator-redesign/design_handoff_landscape_cad_studio/`. README checklist; progress in `IMPLEMENTATION-STATUS.md`.

**Studio styling + UI/UX (binding):** `docs/STUDIO-STYLING-AND-UX.md` — blush frost tokens, disappearing chrome, inventory as summoned popup (never a fixed opaque bar on the drawing), orbit clear of the glyph, contextual pointer. Read this before restyling canvas chrome.

**Operator training (gold walkthrough):** `docs/OPERATOR-STUDIO-GOLD-WALKTHROUGH.md` — six mode workflows, site vs design matrix, Wrights Terrace assist scripts, lane law, anti-patterns, completion checklist.

**Site infrastructure / pre-construction due diligence:** `docs/SITE-INFRASTRUCTURE-AUTOMATED-LINKS.md` — full LA checklist before landscape construction (title, BYDA services, TPZ, overlays, levels, drainage) with LIVE / KEYLESS / BYDA / SITE automation status.

**CAD–AI 2026 UX (binding):** `docs/CAD-AI-2026-UX.md` — disappearing interface, AI as spatial collaborator (sidecar), constraint-first geometry, human-in-the-loop ghosts. Do not reintroduce sticky ribbons or chatbot-only AI.

AI pipeline: heuristic coaching (`buildSketchCanvasAiSuggestions`) + optional vision ghosts API + NL sketch assist (`POST /projects/:id/design/assist` via `buildStudioSystemPrompt`) + CAD ghosts on generate (`generateCadAction`). Ghosts are ephemeral until accept.

**Single branch:** Handoff studio + Vicmap WFS live on `main` — do not reintroduce parallel MapLibre geo-canvas branches.

### UTF-8 / Turbopack

Next.js dev requires valid UTF-8 in imported TS files. Lone Windows-1252 bytes (e.g. `0x97` em dash) cause 500s. Fix only files Turbopack names — do not bulk sed the repo.

**Never rewrite source files through PowerShell text cmdlets on Windows.**
`(Get-Content -Raw) ... | Set-Content` round-trips through the console codepage
and re-encodes: every `—`/`…` in the file becomes `â€"`/`â€¦` mojibake, and
`-Encoding utf8` on PowerShell 5.1 also prepends a BOM. Use the editing tools, or
Node (`fs.readFileSync/writeFileSync` with `"utf8"`, which is byte-exact and adds
no BOM) for scripted sweeps. Verify after any bulk edit:

```powershell
$b=[IO.File]::ReadAllBytes($p)   # 239,187,191 prefix = stray BOM
for($i=0;$i -lt $b.Length-1;$i++){ if($b[$i]-eq 0xC3 -and $b[$i+1]-eq 0xA2){"mojibake"} }
```

### E2E against an already-running dev server

`playwright.config.ts` sets `RATE_LIMIT_MAX: 10000` on the API it starts, because
e2e creates many projects from one loopback IP. `reuseExistingServer` is on
outside CI, so if you reuse a plain `pnpm dev` API you inherit production
throttling and batches of 4+ spec files fail at
`createSurveyProject`/`createAddressProject` with `expect(create.ok())` false.
That is the limiter, not the code — re-run smaller batches, or start the API with
`RATE_LIMIT_MAX=10000`.
