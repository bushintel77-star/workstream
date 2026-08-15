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

Continuous integration gate: `pnpm run ci` (installs frozen lockfile, checks mobile placeholders, portal edge runtime, handoff hex colors against the `--gs-*` token allowlist, then typecheck + lint + vitest).

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

**Gold Standard 2026** is the supreme binding regime. The operator canvas is
being rebuilt as a **Zero-Chrome WebGL studio** (Three.js / React Three Fiber)
per the master brief. The old SVG `%`-coord parchment board + `HandoffDesignStudio`
is being replaced by `WebGLStudio` (R3F `<Canvas>` + DOM Glass Card overlay).

- Home: `/` redirects to `/home` — operator dashboard (address composer + sites list). The old marketing landing with mock telemetry was removed (zero-mock-data law; `docs/UI-PARITY-AUDIT-2026.md` §4)
- Operator canvas: `/projects/[id]?mode=survey|sketch|cad|elevation|quote|present|share|garden`

**Binding docs (read before touching canvas/chrome/rendering):**

- **[`docs/GOLD-STANDARD-2026.md`](docs/GOLD-STANDARD-2026.md)** — SUPREME. The master architectural brief. "The drawing is the product." Zero-Chrome, WebGL primary surface, Glass Cards (`#1E2329/70`, `backdrop-blur-md`, `rounded-2xl`), Studio Dark tokens. If a change contradicts this doc, this doc wins.
- **[`docs/GOLD-STANDARD-2026-TOKENS.md`](docs/GOLD-STANDARD-2026-TOKENS.md)** — Studio Dark palette (`#101418` canvas, `#fbbf24` Primary/Gold, `#0030CF` Truth Anchor/Signal Blue, `#ef4444` Conflict/Strike). Fonts: Space Grotesk (technical/numeric), Inter (UI). Raw `#hex` in handoff modules is CI-gated against the `--gs-*` allowlist.
- **[`docs/GOLD-STANDARD-2026-ARCHITECTURE.md`](docs/GOLD-STANDARD-2026-ARCHITECTURE.md)** — WebGL scene-graph, `SpatialObject` as universal node, camera/chrome layering, metre-space origin `(0,0,0)` peg, hydraulic isolation, billboarding, mobile AR bridge.

**Archived (pre-Gold-Standard, do not follow):** `docs/archive/pre-gold-standard-2026/` — contains the retired `STUDIO-STYLING-AND-UX.md`, `CAD-AI-2026-UX.md`, `OPERATOR-STUDIO-GOLD-WALKTHROUGH.md`, `ENV-AND-SITE-META-STICKY.md`, and `CANVAS-FIRST-*.md` SDS docs. Retained for historical reference only.

**Migration status:** The WebGL studio is THE front end — every canvas mode (survey checklist, sketch, CAD AI-hub, elevation sheet, garden 3D, quote fit-sheet, present lens, share portal) mounts natively as glass chrome over the R3F canvas (ARCHITECTURE §5 pattern: classic feature modules consumed by the new shell). The SVG `HandoffDesignStudio` is a `?svg=1`-only deep fallback for vector node-editing and the long tail of feature docks — it is no longer part of mode routing.

**Vicmap cadastral** (API): keyless DELWP GeoServer WFS at `opendata.maps.vic.gov.au` — `apps/api/src/lib/vicmap.ts` self-discovers property/building layers via GetCapabilities (no `VICMAP_ENABLED` / developer.vic.gov.au API key).

**Site infrastructure honesty:** Vicmap easements ≠ underground assets. Dig needs BYDA (+ often council drainage). Survey 5/5 = digital minimum; full LA pack = `docs/SITE-INFRASTRUCTURE-AUTOMATED-LINKS.md`.

AI pipeline: heuristic coaching (`buildSketchCanvasAiSuggestions`) + optional vision ghosts API + NL sketch assist (`POST /projects/:id/design/assist` via `buildStudioSystemPrompt`) + CAD ghosts on generate (`generateCadAction`). Ghosts are ephemeral until accept. AI is a spatial collaborator inside the drawing, not a chatbot.

**Single branch:** Gold Standard 2026 WebGL studio + Vicmap WFS live on `main` — do not reintroduce parallel geo-canvas branches.

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
