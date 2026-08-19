# Front-end WIP and gap analysis — 2026-08-19

Supersedes `docs/WIP-AND-GAP-ANALYSIS-2026-08-17.md` for state. Written the
same session as the WIP consolidation (`docs/WIP-CONSOLIDATION-2026-08-19.md`),
after the full CI gate went green and production was re-deployed. Companion to
`OUTSTANDING.md` (the live tracker) — this file is the point-in-time audit.

## Method — how each claim was verified

- Git state after consolidation: single branch `main`, clean working tree,
  all 38 stale branches retired, stash and dangling objects proven superseded.
- `pnpm run ci` green end-to-end (evidence below).
- Live production probes: web `/readyz` 200, api `/readyz` 200 with all
  checks true (`store`, `persist_dir`, `db_writable`, `clerk`,
  `public_api_url`, `cors_origin`, `portal_secret`, 827 records). Landing
  HTML carries this session's markers: wordless address-entry hero
  (`hero-address-entry`), Esri World Imagery aerial URLs, "One polygon,
  three moves", Stonnington chip.
- Source inventory: `apps/web/src/components/canvas/webgl` = 107 files (the
  live studio), retained `handoff/` = 91 files, kept e2e = 26 specs, 13
  route trees, **zero** `TODO(`/`FIXME`/`XXX`/`HACK` markers in
  `apps/web/src`.

## CI gate — green, 2026-08-19

| Gate | Result |
|------|--------|
| Frozen-lockfile install | ok |
| Mobile placeholders / distribution | ok |
| Portal edge runtime | ok |
| Handoff hex colours (`--gs-*` allowlist) | ok — 345 files, no raw hex |
| Studio dialect + Tier-1 spec gap | ok — 23 rows: 20 shipped, 3 nongoal, **0 p0 missing** |
| Feature reachability | ok — 10 components, 0 allowlisted |
| CSS scales ratchet | ok — 23 files / 132 declarations frozen, shrink-only |
| Bundle size | ok — 6.18 MB chunks / 5.87 MB JS vs 8 MB / 7 MB budget |
| Traceability | ok — 10 tests |
| Typecheck | ok — 9 packages |
| Lint | ok — `--max-warnings 0` |
| Vitest | ok — 241 files, 1689 tests, 20 env-gated live skips |

## What is shipped (the baseline)

One WebGL studio (`?mode=` only, SVG studio retired): survey → sketch →
CAD/elevation/garden → quote/present/share. Fused ortho↔persp camera,
photo-trace elevation capstone with boundary-snap reconciliation,
sketch→CAD with ghost review and kept source ink, native selection +
marquee, dimension ring, measure tape, terrain/drainage/cut-fill, flora
ring, asset fan-out, live itemized fit sheet, split-view lens, perimeter-tab
chrome, dotted ground field. Shell: wordless landing hero, auth surfaces,
settings, portal deposit flow, share portal. Auxiliary 3D surfaces:
`/growth-studio/[id]`, `/subsurface-studio/[id]`.

## WIP — in flight on the front end

1. **`handoff/` re-homing (structural WIP).** 91 retained modules under the
   retired studio's tree — `features/{ar, assetPanel, elevation, ground,
   present, render, save, share, sunGrowth, surfaces, survey, tilt,
   viewpoint}` + `geometry/` + `state/` — are the shared surfaces kept
   pending re-homing into the WebGL tree (`ONBOARDING.md` §1). Their
   `--hc-*`/`--ws-*` tokens already moved to `styles/globals.css`.
2. **Floating tool ribbon on GL (Phase 1, planned next).** Polyline/Curve
   ribbon is not on the GL surface yet; Area routes to
   `SpatialObject`/`outline_pct`. Soil/aspect soft filters remain SVG-era
   only.
3. **Presentation Lens polish (Phase 3).** Lens and split-view are built;
   the storytelling polish pass is open.
4. **Premium assets** — species depth, thumbnails, curated palettes
   (OUTSTANDING priority 2).
5. **Foliage "murk" polish** — in flight: `09ed590` lifted foliage to the
   light ramp and neutralised the olive ground-bounce; verify the full
   ramp migration is complete.
6. **Signoff record trace (verification).** Signoff route/schema/domain are
   in `main`; the open item is proving the operator `SignoffCard` and the
   portal deposit share one frozen record (OUTSTANDING priority 4).
7. **`webgl-asset-fanout.spec.ts` positional flake** — tracked, not fixed
   (save-debounce vs reload race at batch end, ~50%). Fix before relying
   on batch e2e.
8. **Elevation idle-chrome reading unverified** — 0.1% is "not clean":
   13 painted chrome elements found, none intersecting the board. Confirm
   or lower the baseline.
9. **Mobile follow-ups (front-end adjacent)** — fonts not bundled
   (expo-font + assets); unmounted `MobileFieldBridge` AR component still
   carries dark-era literals.

## Gaps — not built or product-gated

- **Phase 4 Build Pack — not built.** Compliance audit + contractor
  CAD/spec bundle export on the WebGL surface. Largest remaining product
  gap.
- **Mobile Field Bridge AR — deliberately not built.** Needs real
  RTK-GPS + device camera; a fake overlay would be dishonest telemetry.
- **Stage 2 survey-grade CAD** (DXF/DWG export, named layers, survey
  coordinates) — product-gated, do not implement without a schema brief.
- **Mobile offline-first sync** — design only
  (`docs/SYNC-LAYER-DESIGN-OFFLINE-FIRST.md`); no implementation.
- **Live data adapters (canned today, honest in copy):** supplier price
  feeds (`suppliers.ts` DEV prices), Melbourne trade catalog (~30 static
  offers), plant biogenic carbon stubs (7 SKUs), `subtractPolygon`
  inner-ring stub, survey utilities stub.
- **Storybook** for web primitives (P3, not started).
- **Human-owned steps (not code):** Clerk keys, Sentry DSNs, Redis worker,
  EAS store credentials, Litestream bucket, GitLab branch protection —
  all enumerated in `OUTSTANDING.md` §Human-only checklist.

## Standing rules that bound future front-end work

- Title-boundary reconciliation: any sited geometry snaps to the boundary
  or is stamped locational-indicative (`AGENTS.md`).
- Zero-chrome discipline: idle-chrome coverage ratchet
  (`canvas-checklist-s6.spec.ts` baselines: survey 4.1%, sketch 4.4%,
  CAD 2.3%, elevation 0.1%) holds the line.
- Zero-mock-data: no invented telemetry, no fabricated AR precision.
- CSS scales and reachability ratchets can only shrink.

## Deploy state (same session)

- GitLab: `main` pushed (`d40bdad`), CI pipeline on GitLab.
- Railway: api deploy SUCCESS; web already live on the consolidated main
  (the 14:15 re-deploy was SKIPPED as a no-change duplicate of the 12:51
  build) — verified by live landing markers above.

## Same-session additions (post-audit)

- **Vicmap meta chip-set** (`webgl/metaChips.ts` + `MetaChipSet.tsx`,
  15 unit tests): ambient satellite tags orbiting the title boundary —
  cadastral (SPI/PFI, parcel area, LGA), planning (zone, heritage, flood,
  water corp, easements), terrain (steepest-fall slope + aspect, spot-level
  count; sun chip pending a site-wide sun grid). 40% resting frost capsules,
  phase-aware illumination (survey/cad vs elevation/garden), hover/click
  in-place expansion, hidden in present/share. Derived only from real
  records — zero invented chips.
- **Micro-interactions:** tool-aware canvas cursor (crosshair while sketch/
  measure/trench/zone/asset armed; grab/grabbing pan), rail-button hover
  lift (-1px + shadow tier), 150 ms paper cross-fade on mode swap,
  tabular-nums + tightened letter-spacing on dimension labels.
- **Gold Standard compliance sweep** (commit `12ef51a` + `4670765`):
  `docs/GS-2026-COMPLIANCE-SWEEP-2026-08-19.md` — black scrims → neutral
  ink dims, neutral shadow tiers, Signal Blue focus rings, JetBrains Mono
  retired, dark-era dock/control sediment re-tokened, spec radii.
