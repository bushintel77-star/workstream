# Session handover — 2026-08-18 (continuation)

> **CURRENT handover (most recent session log).** PRs #192–#201, live prod
> state, the GitHub-freeze workarounds, and the ranked remaining-work list.
> Live tracker: `OUTSTANDING.md` (its ranked list now reflects the shipped
> photo-trace capstone); new-dev entry: [`ONBOARDING.md`](../ONBOARDING.md).

Written end of the 2026-08-17 evening → 2026-08-18 early-morning session.
Companion to `docs/WIP-AND-GAP-ANALYSIS-2026-08-17.md` (superseded for
state; `OUTSTANDING.md` remains the live tracker).

## State at handoff

- `main` = `e6da28e` (clean except the two pre-existing unrelated
  working-tree mods: `.devin/mcp_config.json`, `apps/web/next-env.d.ts`).
- Production healthy: web + api `/readyz` 200.
- All local gates green at handoff: typecheck 13/13, lint
  `--max-warnings 0`, vitest green, affected e2e green (default-mount,
  smoke, collision, fit-sheet, flora-ring, asset-fanout, cad-annotations,
  photo-flow, terrain, split-view, canvas-first, a11y-axe).

## Shipped this session (PRs #192–#201, all merged)

| PR | What |
|----|------|
| #192 | Mobile tokens → Studio Paper + Signal Blue binding (packages/ui mirror of web --gs-* aliases) |
| #193 | Mobile web preview bundles (sentry platform split + pnpm/metro direct deps) |
| #194 | Studio crash fix — vendored IBL HDR (GitHub raw 429 was killing the canvas) |
| #195 | Tracker note: Railway git-build freeze |
| #196 | Perimeter-tab chrome: one browser-tab chip strip, one left ribbon, no header; all meta surfaces as tab panels |
| #197 | Canvas pointer-interaction fix — poison frame delta blew the camera spring (1e41); spring guard + blend clamp + deterministic arc-tangent up |
| #198 | e2e harness live-capable (API env seeds, domcontentloaded nav, live timeouts) |
| #199 | Aerial underlay retired everywhere (web + mobile); canvas rests on Vicmap boundary/building vectors; quiet auto-trace on open (router.refresh, session-gated, NEXT_PUBLIC_E2E-gated) |
| #200 | Native vegetation (EVC) kind wired into the keyless pipeline (nv2005_evcbcs scorer, sprout-green wash, EVC chip label, Site-panel honesty block with ACHRIS/NatureKit/ELVIS/VicPlan links) |
| #201 | Fix: the hydrate route's inline request schema (site-boundary.ts) was missing the new kind and its default overrode DEFAULT_KINDS |

## Live-verified on production (not just local)

- Drawing interactions work: flora-ring accept, asset placement +
  autosave + reload persistence, measure tape drag.
- Vicmap boundary auto-trace: POST `/boundary/auto-trace` → 201,
  `source_kind: vicmap`.
- Keyless hydrate default now returns `planning, bushfire, contour,
  native_vegetation, water_corp` for the regional Heathcote site
  (`a902f6bf-…`) — real EVC 20 "Heathy Dry Forest" polygons.

## Known issues / workarounds

### GitHub account frozen on a failed payment — DO NOT DEBUG THIS AS A CODE BUG

The GitHub account had a **failed payment** (the card on file for the
GitHub plan), and GitHub froze the account. **The operator resolves it,
not the code** — do not spend time triaging these symptoms:

- **GitHub Actions shows a bizarre `0-second startup_failure with zero
  jobs`** — that is GitHub killing runs on a frozen account, not a
  broken workflow. The CI code was already fixed on main (`5a5e0ee`
  regenerated the lockfile; the osmic git-SSH clone was replaced by a
  public HTTPS tarball).
- **Railway git-linked builds fail silently** — they stop right after
  "scheduling build on Metal builder" with `FAILED`/`deploymentStopped`
  and no build logs. That is the frozen account stalling webhook
  deliveries, not a build error.
- **What still works while frozen:** pushes, merges, PRs, and Railway
  CLI deploys. Use:
  `railway up --detach --service <web|api> --environment production -m "…"`
  then poll `railway deployment list` for SUCCESS. A deploy with no
  build logs may have reused a stale image — touch a source file and
  re-up to force a fresh build.
- **How the operator clears it:** GitHub → Settings → Billing → update
  the payment method / settle the charge. The account unfreezes
  automatically (usually within minutes). **When that happens:** the
  one outstanding verification is dispatching GitHub Actions CI on
  `main` to confirm green on GitHub's own runners — everything else
  (typecheck, lint, vitest, e2e, live prod probes) is already verified
  locally and live.

### Other known items

- **Classic `?svg=1` studio specs red** (pre-existing, tracked in
  OUTSTANDING): `quote-tier1` renders the WebGL mount despite `?svg=1`
  (page.tsx routing), plus several canvas-* classic specs. Not touched
  this session.
- Mobile font assets still not bundled (token names correct; system
  fallback at runtime).
- Railway SSH key `dsh-agent` registered for the workspace (useful for
  container forensics).

## Where things live

- Chrome: `apps/web/src/components/canvas/webgl/PerimeterTabStrip.tsx`,
  `WebGLStudioPreview.tsx` (panel system), `StudioToolRail.tsx`.
- Camera/pointer: `FusedCamera.tsx`, `cameraAnimation.ts` (spring),
  `cameraRig.ts`.
- Data pipeline: `apps/api/src/lib/vicmap.ts` (kind registry + scorers),
  `keyless-job.ts` (DEFAULT_KINDS + hydrate), `siteTruthImport.ts`
  (web import/auto-trace), `packages/contracts/src/schemas/site-boundary.ts`
  (hydrate request schema — has its OWN enum; keep in sync with
  `catalog.ts` KeylessOverlayKindSchema when adding kinds).

## Ranked remaining work (unchanged priority)

1. CI live-verify once the card clears (dispatch Actions on main).
2. Photo-trace elevation capstone (calibration UX decision first).
3. Premium assets (species depth, thumbnails, curated palettes).
4. Foliage "murk" light-ramp polish (dark-era d-* ramp + olive
   ground-bounce on the paper canvas).
5. Signoff record trace (signoff must freeze the accepted quote).
6. Classic-studio spec debt (quote-tier1 / ?svg=1 routing).

## Gotchas for the next context

- `apps/api` tests resolve `@workstream/domain` from its built `dist` —
  run `pnpm --filter @workstream/domain build` after domain edits.
- `pnpm run ci` runs the full gate; CI e2e is non-blocking by design.
- Never rewrite source files through PowerShell text cmdlets (BOM +
  mojibake). Use the editing tools or Node fs.
- e2e live mode: `LIVE_E2E=1` + `PLAYWRIGHT_BASE_URL` + `API_URL`;
  specs seed via `API_URL`, navigate `domcontentloaded`, and the
  studio's quiet auto-trace is gated off under `NEXT_PUBLIC_E2E=1`.
- Railway deploy from repo root uses the service configs
  (`apps/web/railway.toml` for web; root `railway.toml` for api).
