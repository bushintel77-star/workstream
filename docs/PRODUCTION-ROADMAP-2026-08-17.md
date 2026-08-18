# Workstream — Production Roadmap (Desktop + Handheld)

**Date:** 2026-08-17 · **Status:** Living doc — update the status table each audit session.

> **Updated 2026-08-18 (docs-vs-code audit):** inline `[2026-08-18]` notes
> correct the items that have moved since this was written — sketch→CAD
> parse built + wired (classic stack), signoff shipped (#175), camera pan
> per-frame React writes fixed (#178/#186), web lint gate green (#177),
> photo-trace elevation shipped (working tree). Current entry doc:
> `ONBOARDING.md`; live tracker: `OUTSTANDING.md`.

Workstream is a **two-surface product** — desktop design studio (web) and
handheld field companion (Expo) — running one pipeline. The product is defined
by **four screens/stages**, and this roadmap is built around them. Each screen
has a build-state matrix (what exists / what's missing), an **automation rail**
(the gate that proves it works), and **acceptance criteria**. The engineering
phases at the end are the workstreams that deliver the screens.

---

## 1. Core principle — ground truth first, everything derived

**Survey gives the user ground truth; every estimate is valid because it is
computed from real-life data fundamentals, never invented.**

The survey screen is the **source of truth** for the whole product. Everything
downstream — buildable area, live BOM, material volumes, the quote — is
*derived* from the ground-truth site model, so its numbers are trustworthy
because their inputs were real. This is already the architectural spine; the
contracts encode it literally:

- `SurveySchema` — `title_polygon` / `house_polygon` / `garden_polygon`,
  `lot_area_m2` / `house_area_m2` / `garden_area_m2`, and edge `measurements`
  (length + bearing). Zero means unknown — never invented:
  - *"Zero means title area unknown — never invent a seed lot."*
  - *"Zero means the existing-house outline is unavailable — never fabricate it."*
- `SiteBoundarySchema` — provenance on every vertex
  (`source: GIS_PARCEL | AI_GENERATED | HUMAN_EDITED | HUMAN_ADDED`,
  `is_master_reference`, `source_kind: vicmap | geojson_ingest | ai_trace |
  manual`), `calculated_metrics` with `ai_confidence`, and a `geo_reference`
  (canvas origin + metres-per-unit) so every coordinate is traceable to real
  ground.
- `BoundaryAutoTrace` / `KeylessHydrate` — Vicmap title ring, dwelling,
  easements, urban trees, neighbour buildings, and the overlay set (planning,
  bushfire, contour, flood, heritage, water_corp, road_casement, acid_sulfate,
  wetland). With honesty rules baked in: *"Never invent DBH; TPZ stays
  operator-measured on site"*, *"Height is usually absent — a default storey
  assumption applies downstream"*.

**The product rule that follows:** every estimate must be **traceable** to a
ground-truth source. A BOM volume is only valid if it derives from the closed
boundary ring + real levels; a quote is only valid if it derives from the BOM.
If a figure cannot point to its source measurement, it must be labelled
*indicative* — never passed off as ground truth. This is the exact honesty rule
`STUDIO-PRODUCT-PHASES.md` already sets for the sketch ("confirm on site / title
/ locate").

## 2. Design principles — 2026 gold-standard, AI-native, canvas-first

The binding UX law for every screen and feature; full spec in the canonical
**`DESIGN-PRINCIPLES-2026.md`** (sources: `GOLD-STANDARD-2026.md`,
`GOLD-STANDARD-2026-ARCHITECTURE.md`, `DESIGN-DNA.md`).

- **Pillar A — AI-native:** AI is woven into the drafting act on the canvas as
  provisional ghosts; one-gesture accept; traceable or labelled indicative.
- **Pillar B — Canvas-first:** the drawing is the product; floating frosted
  Paper Cards, zero permanent chrome, 60fps ref-based interaction.
- **Pillar C — Gold-standard drafting:** site-plan grammar (boundary lines,
  scale bar, north arrow, title block); metre-space origin-locked;
  Southern-Hemisphere correctness non-negotiable; honest readouts.
- **Conformance check (audit):** any modal-for-core-action, un-ghosted AI, or
  untraceable readout is logged as design debt and fixed before the screen is
  done.

## 3. The four product screens (the spine)

### Screen 1 — Survey & site intelligence ("does it all")
One pass that assembles the site:

- **Title data** — pull via **Vicmap** (`opendata.maps.vic.gov.au` WFS
  `INTERSECTS` → title ring → canvas co-register; pattern documented in
  `SITE-INFRASTRUCTURE-AUTOMATED-LINKS.md`) + links to **council** sites.
- **Overlays** — tree root protection (**TPZ**), **heritage**, easements,
  **underground pipes/cables** (BYDA: sewer / gas / power / NBN / water / SW).
- **Geometry** — draw the **boundary** (trace tool — ring closure now fixed,
  PR #173), then the **buildable area** (setbacks + BYDA + keyless overlays).
- **Dwelling in frame** — render the dwelling so it **casts shade and sun**
  (SunCastOverlay + 3D sun rig).
- **Contours** — map the site's **health contours for drainage** (terrain mesh
  from spot levels + drainage flow).
- **Live estimation** — a running estimate **calculating each asset and
  measurement as you draw** (LiveBomDock).

**Build state:** `site-context` API + survey job, Mapbox aerial, easements /
services / utilities overlays, TPZ, BuildableAreaOverlay, SunCastOverlay,
TerrainMesh + DrainageFlowLayer, LiveBomDock all exist. **Missing:** live Vicmap
title fetch (only documented), council/BYDA data fetch, live-estimate figures
wired to the running BOM.

**Rail:** *survey completeness gate* — the "Survey 5/5" minimum (boundary,
dwelling, trees, levels, services/easements) must be present before a project
can leave this screen.

**Acceptance:** entering an address hydrates title ring + overlays automatically;
drawing the boundary updates the live BOM (area · volumes · asset count) in
real time; the dwelling casts correct Southern-Hemisphere shadows; every BOM
figure traces to a ground-truth source (boundary vertex, survey measurement,
or an operator-measured TPZ) — nothing invented.

### Screen 2 — Concept sketch (freehand)
- **Draw by hand**; the **AI keeps it tidy** but it stays freehand.
- Two export styles: **freehand over the birdseye image**, or **photo taken on
  site and scribbled over the top**.
- The result is **parsed to CAD** for Screen 3.

**Build state:** sketch tool (pen/eraser/line/rect/circle), freehand strokes,
aerial upload, mobile `measure-photo` capture exist. **[2026-08-18] The
"Missing" list below is stale:** AI tidy-up (`sketch-tidy`) and sketch → CAD
parse (`sketch-convert-cad` → `POST /projects/:id/sketch-cad` →
`formalizeSketchToCad`, Claude vision + heuristic fallback) are built and
wired into the classic studio + pipeline (see `FEATURE-LIST-CONCEPT-TO-SIGNOFF.md`
C3/C6, which is the accurate coverage); the "scribble over site photo"
export shipped as the photo-trace elevation capstone (WebGL studio, working
tree 2026-08-18). Remaining Screen 2 gap: none of the sketch→CAD parse is
surfaced **on the WebGL studio** yet — the GL freehand ink persists but does
not convert.** Missing:** ~~AI tidy-up on freehand, the "scribble over site photo" export, sketch → CAD parse.~~

**Rail:** *sketch → CAD fidelity gate* — a parsed sketch must produce closed,
snapped geometry with no freehand artifacts.

### Screen 3 — CAD design (desktop)
- Sit at the desktop and build the **full design**: **landscaping,
  hardscaping, irrigation, drainage**.
- Consumes Screen 2's parsed concept as the starting layer.

**Build state:** 2D CAD board (CadPlanBoard), asset palette, irrigation zones,
drainage flow, 3D garden/studio exist. **Missing:** hardscape/planting
takeoff → BOM integration, full design → quote handoff.

**Rail:** *design → BOM gate* — every placed asset appears in the live BOM with
a costable quantity.

### Screen 4 — Signoff & presentation quotation
- **Signoff**, **presentation** (fit sheet / sheets), and **quotation**
  (see `QUOTE_WORKFLOW.md`).

**Build state:** FitSheetOverlay, LiveBomDock, quote workflow doc, client portal
exist. **[2026-08-18] Signoff shipped (PR #175 — `SignoffCard`,
`signoffReadiness`/`createSignoffRecord`, immutable once signed off); the
open item is the record-trace verification (signoff must freeze the accepted
quote — `OUTSTANDING.md` priority 4).** Missing: ~~signoff flow~~,
presentation export, quote generation from the
closed boundary + BOM.

**Rail:** *quote accuracy + traceability gate* — a quote's area/volumes must
match the closed geometry within tolerance (why the boundary ring closure was a
prerequisite), and every figure must trace back to a ground-truth source.
Anything without a source is labelled *indicative*, never quoted as fact.

---

## 2. Current state (verified 2026-08-17)

| Area | State |
| ---- | ----- |
| **Monorepo** | pnpm 9.15.4; packages: `web`, `api`, `mobile`, `domain`, `contracts`, `cad`, `db`, `client`, `ui` |
| **Desktop (web)** | Next.js + R3F WebGL studio, 2D handoff CAD, demo garden, growth studio, subsurface studio, Clerk auth |
| **Handheld (mobile)** | Expo ~57, expo-router, Clerk; screens: project list, recording (voice), processing (design/costing/audit stages), measure-photo, grid-soil, filing, confirm-pin, design-studio viewer |
| **Pipeline** | `capture-pipeline.ts`: transcription → survey wired; design/costing/audit jobs exist but lack a stage runner (see `STAGED-AUTONOMOUS-BUILD-PLAN.md`) |
| **CI** | 13-package typecheck green; unit suites green (754 canvas tests); ~~web lint has pre-existing failures~~ **[2026-08-18] lint gate green (#177)**; GitHub Actions **blocked** (account hold) |
| **Deploy** | Railway auto-deploy web + api from `main`; Docker; api-volume attached |
| **Known canvas gaps** | ~~WebGL camera pan still writes React state per frame~~ **[2026-08-18] fixed (#178/#186 — store refs, zero-commit e2e gate)**; hover HUD now rAF-throttled; environment panel season still sourced from API badge |

**Human-owned blockers** (from `WORKSTREAM-STATUS.md`): GitHub Actions billing,
Clerk live app + Railway vars, Redis worker scale, Sentry DSNs, EAS + store
credentials, branch protection, external keys (Mapbox/Stripe/OpenAI).

---

## 4. Engineering phases (workstreams that deliver the screens)

Each phase has a **goal**, **deliverables**, its **automation rail**, and
**acceptance criteria**. A phase is *done* only when its criteria pass in CI.

### Phase 0 — Stabilize the rails (0–2 weeks) · *serves all screens*
- Unblock GitHub Actions (human: billing); re-enable `ci.yml` + `gitleaks.yml`.
- Green lint gate (fix pre-existing `PlannerDock.tsx` `@ts-ignore` + e2e `process` no-undef).
- Wire typecheck + lint + unit + e2e as **required PR checks**; Railway **staging** with per-PR previews; secrets single source.
- **Rail:** CI gate — typecheck (13/13), lint `--max-warnings 0`, unit, Playwright smoke green on every PR.
- **Acceptance:** a broken PR cannot merge; a merged PR auto-deploys to staging.

### Phase 1 — Screen 1 to production (2–6 weeks)
- Live **Vicmap title fetch** (implement the documented WFS `INTERSECTS` hydrate) + council/BYDA overlay fetch.
- **Live estimation** wired to the running BOM (area · volumes · asset count update as you draw).
- Persistence & versioning (no lost strokes/placements), orgs/roles, share links.
- Performance isolation: camera pan via refs (last per-frame React write), 60fps gate; Sentry.
- **Rail:** *survey completeness + traceability + perf gate* — e2e for "address → title ring → overlays → boundary → live BOM"; assert every BOM figure derives from ground truth (no invented numbers); pan-drag zero React commits; p95 frame budget.
- **Acceptance:** Survey 5/5 auto-hydrated; live BOM tracks the drawing; dwelling casts correct shadows.

### Phase 2 — Screens 2–3 to production (4–10 weeks)
- **Screen 2:** AI tidy-up on freehand, "scribble over site photo" export, sketch → CAD parse.
- **Screen 3:** full design authoring — landscaping, hardscaping, irrigation, drainage — with every asset flowing into the BOM.
- **Handheld:** offline-first + sync so field capture (Screen 2 photo/scribble, Screen 1 survey notes) lands in the studio; EAS builds.
- **Rail:** *sketch→CAD fidelity gate*, *design→BOM gate*, *mobile gate* (EAS build + capture→sync smoke).
- **Acceptance:** a site photo scribble parses to closed CAD; a placed asset appears costable in the BOM; offline capture syncs to the desktop.

### Phase 3 — Screen 4 to production (6–12 weeks)
- **Signoff** flow, **presentation** export (fit sheets), **quotation** from closed boundary + BOM.
- Real-time collaboration, team workspaces, Stripe billing.
- **Rail:** *quote accuracy gate* — quote area/volumes match closed geometry within tolerance; multi-user e2e; billing webhook tests.
- **Acceptance:** a completed design produces a presentation + quote without manual re-entry.

---

## 5. Automation rails (cross-cutting)

| Rail | What it runs | When | Blocks |
| ---- | ------------ | ---- | ------ |
| **CI gate** | typecheck (13/13), lint `--max-warnings 0`, unit suites | every PR | merge |
| **E2E gate** | `webgl-*`, `canvas-chrome`, survey→sketch→CAD→quote flow, mobile smoke | every PR | merge |
| **Preview deploys** | Railway staging per PR | every PR | manual promote |
| **Screen gates** | survey 5/5 + traceability · sketch→CAD fidelity · design→BOM · quote accuracy | per screen | screen done |
| **Release train** | versioned tags + changelog on `main` | per release | — |
| **Mobile builds** | EAS Android + iOS | release branch | store submission |
| **Secret scan** | gitleaks | every push | merge |

## 6. Audit framework

- **Tracked doc:** this roadmap + a per-screen audit checklist; update the status
  table each session.
- **Cadence:** weekly agent audit session checks each **screen** against its
  acceptance criteria and records results here.
- **Gate rule:** a screen is *done* only when its acceptance criteria pass in CI
  (its rail). Anything merged without its rail is logged as debt.
- **Traceability rule (audit):** every audit session spot-checks that BOM/quote
  figures trace to a ground-truth source; any figure that cannot is marked
  *indicative* or fixed.
- **Design-principles rule (audit):** every screen is checked against the three
  pillars (AI-native, canvas-first, gold-standard drafting). Any modal-for-core-
action, un-ghosted AI, or untraceable readout is logged as design debt.
- **Status table:** `⬜ not started · 🟡 in progress · 🟢 done · 🔴 blocked`.

| Screen | What exists (verified 2026-08-17) | Missing | Rail | Status |
| ------ | --------------------------------- | ------- | ---- | ------ |
| 1 — Survey | site-context, aerial, overlays, TPZ, buildable, sun, terrain/drainage, **live BOM (worker)**, **Vicmap + keyless hydrate verified live** | council/BYDA live data pull | survey completeness | 🟡 |
| 2 — Concept sketch | sketch tool, freehand, photo/image underlay, **AI tidy**, **sketch→CAD** | freehand export polish | sketch→CAD fidelity | 🟡 |
| 3 — CAD design | CadPlanBoard, assets, **plant DB + schedule**, **irrigation hydraulics**, drainage, 3D, **live BOM** | hardscape detailing | design→BOM | 🟡 |
| 4 — Signoff & quote | FitSheet, LiveBomDock, quote doc, portal, **signoff flow (PR #175)** | presentation export, council-pack | quote accuracy | 🟡 |

| Phase | Goal | Rail | Status |
| ----- | ---- | ---- | ------ |
| 0 — Stabilize rails | green CI + staging | CI gate | 🔴 blocked on Actions billing |
| 1 — Screen 1 to prod | live survey + BOM | survey completeness + perf | 🟡 (canvas batch PR #173; Vicmap live verified) |
| 2 — Screens 2–3 to prod | sketch→CAD + full design | fidelity + BOM + mobile | 🟡 (core built; mobile offline/sync pending) |
| 3 — Screen 4 to prod | signoff + quote | quote accuracy | 🟡 (signoff PR #175; presentation/council-pack pending) |

---

## 7. Immediate next actions

1. **Phase 0:** fix pre-existing web lint failures (cheap, unblocks the lint
   gate); resolve the GitHub Actions billing hold (human).
2. **Phase 1:** merge PR #173 (canvas batch) + #175 (signoff). The **Vicmap
   hydrate is built and verified live** and the **live BOM is wired**; the
   remaining Screen 1 work is council/BYDA live data.
3. **Phase 2:** the offline-first sync layer for the handheld (screens exist,
   sync does not) and council/BYDA live data pull.
4. **Phase 3:** presentation export and council-pack export (the last Screen 4
   polish before quoting is end-to-end).
