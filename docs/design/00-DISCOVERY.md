# 00 — Discovery (Phase 0)

Pre-flight inventory for the UX/UI overhaul mega plan. Every claim below cites a file path
and, where it matters, a line number. Produced by reading the repo, not from the screenshots.

**Read this before planning.** It corrects three premises in the original brief that would
otherwise send the plan in the wrong direction.

---

> **If you read one section, read §10.** Two contradictory design systems ship in this app and
> deciding which governs the canvas is a prerequisite to every other item here. §11 lists the
> 63 existing design docs — including seven paid external-designer briefs — that any plan must
> reconcile with rather than duplicate.

## 0. Headline — the three things that change the plan

### 0.1 The design system is not the problem. Adoption and composition are.

The brief assumed hardcoded colours and an absent token system. **Wrong.** There is a
mature, documented token spec at `apps/web/src/styles/color-tokens.css` (219 lines, 129
tokens, raw-palette/semantic split, WCAG pairs verified in-comment), plus a 15-step named
z-layer scale at `apps/web/src/components/canvas/handoff/handoffStudio.module.css:100-114`.

Measured adoption across all `*.module.css` in `apps/web/src`:

| Metric | Count |
|---|---|
| `var(--token)` usages | **6,747** |
| Raw hex literals | 68 (10 distinct) |
| `rgba()` literals | 96 (18 distinct) |

That is ~99% token adoption. Do not plan a token migration. Plan **enforcement of the system
that already exists**, and fix what the system does not yet cover.

### 0.2 The floating-panel chaos is a composition problem with a hard number attached

`apps/web/src/components/canvas/handoff/features/` contains **62 feature folders**, each with
its own CSS module, and collectively **233 `position: absolute` declarations** (vs 2 `fixed`,
2 `sticky`). Every feature positions itself independently against the studio root.

The z-scale is respected ~71% of the time: of 218 `z-index` declarations, **~155 use the
`--ws-z-*` tokens and ~63 are raw magic numbers**, including `999`, `1000`, `1100` — the
classic "I need to be on top" escapes that defeat a layering model. Worst offenders:

- `components/canvas/siteCanvas.module.css` — 12 raw values (0,1,2,4,5,6,6,6,7,8,10,12,38)
- `components/canvas/handoff/features/present/present.module.css` — 11 raw values
- `components/ui/kit/kit.module.css:446,465,612` — 999 / 1000 / 1100
- `components/ui/ui.module.css:8` — 1000; `components/toast-host.module.css:10` — 1000

### 0.3 There is a data-integrity bug underneath the Quote address discrepancy, and it is worse than a formatting issue

See §5. Short version: **the studio canvas is pinned to a demo seed site and structurally
cannot display the real project address, geometry, or site metadata.** The Quote surface reads
the real project. That is why the two disagree on screen. The Vicmap cadastral lookup also
runs against the demo address. This is a correctness bug, not a design bug, and it should be
fixed before any restyling of those surfaces.

---

## 1. Stack

Turborepo + pnpm 9.15.4 monorepo (`package.json`, `turbo.json`, `pnpm-workspace.yaml`).

- `apps/` — `api`, `mobile`, `web`
- `packages/` — `cad`, `client`, `contracts`, `db`, `domain`, `ui`

`apps/web` (`@workstream/web`) is the surface under review:

- **Next.js 16.2.12**, React 19.2.6, App Router (`src/app/`)
- **Styling: CSS Modules** — ~130 `*.module.css` files. No Tailwind, no CSS-in-JS.
- `three` 0.185 + `suncalc` (elevation / shadow study), `roughjs` 4.6 (hand-drawn sketch)
- `@clerk/nextjs` auth, Playwright e2e
- 510 `.ts`/`.tsx` files in `apps/web/src`

Existing CI guardrail scripts (`scripts/`) — precedent for adding more:
`check-handoff-chrome-colors.mjs`, `check-portal-edge.mjs`, `check-mobile-placeholders.mjs`,
`scrub-handoff-chrome-colors.mjs`. Wired into `pnpm ci` in root `package.json`.

---

## 2. Canvas render architecture

There are **two rendering worlds**, and the plan must treat them separately.

### 2.1 Designer studio — SVG

Survey, Sketch, Cad, Elevation, Quote and Present all render SVG. In
`apps/web/src/components/canvas/`: 38 `.tsx` files emit `<svg>`, 3 touch `getContext(`.
`ElevationBoard.tsx` is SVG — "Elevation" in the nav is a 2D elevation drawing, not a 3D view.
`ArBirdseyeOverlay.tsx` (323 lines) is also SVG + CSS transforms despite the name.

**Rough.js is in this path**, via `features/render/handDrawnPen.ts` — `RoughGenerator`
(geometry generator, not `RoughCanvas`), consumed by `features/cadPlan/CadPlanBoard.tsx`. It
emits path data rendered as SVG, seeded by `projectId + role` so a plan redraws identically.

So for the studio, **ink tiering is a styling change**, not a rendering rewrite. Downgrade
that effort estimate.

### 2.2 Client share twin — THREE.js / WebGL

`components/share/ClientShareTwin.tsx` (571 lines) is a real 3D scene:
`THREE.WebGLRenderer`, `Scene`, `PerspectiveCamera`, `MeshStandardMaterial`, with
`safeDispose` teardown and an `atmosphere` pigment setting. Rendered by
`components/share/ClientShareDecision.tsx:92`, i.e. on the **client-facing share page**
(`app/share/[token]/`).

**This is the gap the brief did not anticipate.** CSS custom properties do not reach WebGL
materials. Every token decision in Phase 1 — colour grammar, ink tiers, atmosphere — needs a
**parallel expression as Three.js material/light parameters**, or the most client-facing
surface in the product will visibly drift from the rest of the app. Treat it as its own
workstream with its own section in 02-SURFACES.md, not as a styling pass.

### 2.3 There is already a partial ink-tier system — extend it, don't replace it

`handDrawnPen.ts` defines `HandDrawnProfile`: `boundary | building | region | canopy |
leader`, each with tuned `roughness` / `bowing` / `maxRandomnessOffset`. The in-file comment
states the intent directly: *"Role-tuned pencil weight — boundary firmer than canopy."*

That is a role-based weight hierarchy that already exists **for sketch geometry** and does not
extend to text, dimensions, or annotations. The Phase 1 ink-tier scale should be designed as a
superset of these role names so the two systems share vocabulary rather than compete.

Largest components (god-component risk, and the real blast-radius driver):

| File | Lines |
|---|---|
| `handoff/HandoffDesignStudio.tsx` | **5,742** |
| `handoff/features/cadPlan/CadPlanBoard.tsx` | 3,044 |
| `handoff/features/present/PresentSurface.tsx` | 2,097 |
| `handoff/features/fitSheet/FitSheetOverlay.tsx` | 674 |
| `handoff/features/commandPalette/StudioCommandPalette.tsx` | 636 |

---

## 3. What the design system already covers (do not rebuild)

From `handoff/handoffStudio.module.css:100-140`:

**Z-layer scale** — 15 named steps, each documented with its intended occupants:
`base 0 · geometry 1 · wash 4 · annotate 8 · interact 12 · chrome 20 · panel 24 · frame 30 ·
dock 40 · contextual 42 · sticky 48 · lane 52 · veil 55 · modal 60 · fullscreen 80`

**Safe-area insets** — `--ws-safe-left: 120px`, `--ws-safe-top: 40px`, `--ws-safe-right: 12px`,
`--ws-safe-bottom: 36px`.

**"Lane law"** — `--ws-lane-w` / `--ws-lane-reserve` exist specifically so floating panels
clear the right data lane. The in-file comment states the intent: *"Keeps the 'lane law' (no
card overlap) satisfied by construction instead of each occupant re-guessing the reserve."*

**Type scale** — `--ws-type-kicker: 8px`, `--ws-type-dim: 11px`, `--ws-type-hud: 11px`.

---

## 4. What the system does NOT cover (this is the actual gap)

### 4.1 No ink-tier scale

There is no token expressing "geometry vs dimension vs annotation vs advisory." Instead,
feature modules hand-roll opacity. Distinct non-binary opacity values in use across
`features/`: `0.4, 0.45, 0.5, 0.55, 0.7, 0.72, 0.75, 0.85, 0.92, 0.95` — **10 ad-hoc values,
12 occurrences of 0.55 alone.** This is the measurable form of "everything on the canvas reads
at the same weight."

### 4.2 The type scale collapses at the point it matters

`--ws-type-dim: 11px` and `--ws-type-hud: 11px` are **the same value**. Dimension text and HUD
text are typographically identical by construction. A tier system needs them separated.

### 4.3 No enforcement

The z-scale, lane law and safe insets are conventions with no lint or CI check. Hence the 63
raw z-index escapes. Given three guardrail scripts already exist and run in `pnpm ci`, adding
a fourth is a well-trodden path — this is the cheapest structural win in the whole plan.

---

## 5. The Quote address discrepancy — root cause

**Verdict: not a fixture, not a cache. A dead fallback that makes the real project address
unreachable on the studio canvas.**

The chain:

```
components/canvas/handoff/state/useStudioState.ts:3826-3827
  const siteAddress =
    STUDIO_SITES[state.ui.siteIdx]?.addr ?? (address || STUDIO_SITES[0]!.addr);
```

`siteIdx` initialises to `0` (`useStudioState.ts:676`) and is guarded against going out of
range (`useStudioState.ts:897`). So `STUDIO_SITES[siteIdx]` is **always defined**, the `??`
never falls through, and `address` — the real project address — is **unreachable**.

```
components/canvas/handoff/HandoffDesignStudio.tsx:2012
  const displayAddress = studio.siteAddress || projectAddress;
```

`studio.siteAddress` is always truthy per the above, so `|| projectAddress` is **dead code**.
`displayAddress` is always the demo seed — `STUDIO_SITES[0]` = *12 Wrights Terrace, Prahran
VIC 3181*.

`displayAddress` then feeds the header (`HandoffDesignStudio.tsx:3117`) and 11 other call
sites (3401, 3675-76, 3746-47, 3771-72, 3866, 4486, 4973).

Meanwhile the Quote is wired to the real thing:

```
HandoffDesignStudio.tsx:3565, 5034   address={projectAddress}
features/tier1/QuoteSurface.tsx:8    /** Project create address — not the studio seed site
                                         label (defaults Wrights). */
```

Two surfaces, two different notions of "the site," rendered simultaneously. Hence *12 Wrights
Terrace* in the header and *60 Malvern Road, Glenwood NSW* on the quote.

### 5.1 Two consequences that are worse than the visible symptom

**Cadastral lookup runs against the demo address.** `HandoffDesignStudio.tsx:2479` calls
`lookupCadastralTitleAction(projectId, displayAddress)`. Every PFI, boundary, zoning and
overlay value in the Vicmap chips is therefore fetched for 12 Wrights Terrace regardless of
which project is open. The `PFI 2684124 · Stonnington` shown in the screenshots is the demo
parcel, not the user's.

**Site metadata is also seeded.** `useStudioState.ts:4126` —
`siteMeta: STUDIO_SITES[siteIdx]?.meta ?? STUDIO_SITES[0]!.meta` — so trees/TPZ/BYDA/env chip
content comes from the demo catalog too.

**Recommendation:** fix this before, and separately from, any visual work on the header,
context bar, or Quote. It is a one-commit correctness fix with its own test, and bundling it
into a restyle would make it unrevertable. It also changes what the redesigned context bar is
actually displaying, so the design work depends on it.

---

## 6. Top-right context bar clipping — root cause

File: `components/canvas/handoff/features/stickyMeta/vicGovChips.module.css`
Component: `features/stickyMeta/VicGovStatusChipRow.tsx`

**The clipping is deliberate, and it is two independent truncations stacking.**

**Truncation 1 — the value text.** `vicGovChips.module.css:192-203`:
```css
.face { white-space: nowrap; max-width: 104px; overflow: hidden; text-overflow: ellipsis; }
```
Any chip value longer than 104px ellipsises. This is what produces `6.1h · Late wi…`.

**Truncation 2 — the cluster.** `vicGovChips.module.css:29-36`:
```css
max-width: min(420px, calc((100vw - var(--ws-frame-left,48px) - var(--ws-frame-right,14px)) / 2 - 40px));
overflow-x: auto;
scrollbar-width: none;
```
plus `.row::-webkit-scrollbar { display: none }` (line 146). Chips are `flex: 0 0 auto`
(line 113) so they do not shrink — they overflow and the row scrolls. **With the scrollbar
hidden and zero `mask-image` or horizontal gradient anywhere in the file (verified: 0
matches), there is no affordance that more content exists.**

The only recovery path is the native `title` attribute (`VicGovStatusChipRow.tsx:158`), which
is not discoverable, not touch-accessible, and not keyboard-accessible.

**Context — this was a deliberate fix for a worse bug.** The in-file comment at lines 20-23
records the history: *"Each cluster anchors to its own frame corner — never a single
full-width bar across the plan, which collided with the right data lane and clipped the tail
chip."* And `.context[data-lane="busy"]` (lines 78-84) correctly reserves `--ws-lane-reserve`
when the lane is open.

So the team already hit this and solved the collision. What is left unsolved is **content
overflow within the capped cluster with no visible affordance.** The brief's instruction to
merge the two bars into one full-width strip would **regress the lane collision this code was
written to fix** — the redesign must keep two corner-anchored clusters, or reserve the lane
explicitly. Flag this to whoever writes 02-SURFACES.md.

---

## 7. Corrections to the original brief

| Brief claimed | Reality |
|---|---|
| Colours/spacing likely hardcoded per component; plan a token migration | 99% token adoption already. Plan enforcement, not migration. |
| No z-hierarchy; everything floats at one level | A documented 15-step z-scale exists. ~29% of declarations bypass it. |
| Ink tiering may be a canvas-architecture change | Studio canvas is SVG — styling change, lower the estimate. But see §2.2: the client share twin is Three.js/WebGL and needs a parallel material-level treatment. |
| (not raised) | A partial role-weight system already exists in `handDrawnPen.ts` (`HandDrawnProfile`). Extend it; don't build a competing vocabulary. |
| Consolidate the two Vicmap bars into one full-width strip | Would regress a fixed lane-collision bug. Keep two corner clusters. |
| Quote address is a bug, fixture, or stale cache | A dead `??`/`||` fallback. Real address is structurally unreachable on canvas, and cadastral lookup runs against the demo parcel. |

Two brief claims held up exactly as written: **the canvas has no ink tiering** (quantified in
§4.1) and **there is no enforcement of the layout system** (§4.3).

---

## 8. Open questions

1. **Is the demo site switcher (`STUDIO_SITES`) meant to ship?** The fix for §5 differs
   entirely depending on whether it is a demo affordance to be removed or a real feature whose
   precedence over the project address is intentional.
2. **What is the minimum supported viewport width?** The clipping was observed at ~1920px, so
   the 420px cluster cap is binding even on large displays. Needs a stated target.
3. **Is `siteMeta` (trees/BYDA/env) expected to come from live data eventually,** or is the
   seed catalog the permanent source for those chips?
4. **Which surfaces are client-facing vs internal?** Quote and Present clearly go to clients;
   this changes the a11y and polish bar per surface.
5. **Is `HandoffDesignStudio.tsx` (5,742 lines) in scope for decomposition,** or should the
   plan work around it? This is the largest single lever on blast radius.
6. **How closely must the 3D client twin match the 2D studio?** If it is meant to read as the
   same product, the Phase 1 token work needs a Three.js material mapping and someone has to
   own it. If it is deliberately a different register (photoreal vs drawn), say so and scope it
   out — but decide explicitly rather than by drift.

---

## 9. Suggested effect on sequencing

1. **Fix §5 first, standalone, with a test.** Correctness before cosmetics, and the context-bar
   redesign depends on knowing what it will actually display.
2. **Add a z-index/opacity lint guard** alongside the existing three `scripts/check-*.mjs`.
   Cheapest structural win; stops the 63 escapes from becoming 80.
3. **Add ink-tier and separated type tokens** to `handoffStudio.module.css`, then migrate
   canvas SVG text onto them. Pure styling given §2.
4. **Context bar affordance** — fade mask + expand-on-demand, keeping two corner clusters.
5. Header regroup, Present empty state, Quote formatting.

`siteCanvas.module.css` and `present.module.css` carry 23 of the 63 raw z-index escapes
between them and are the natural first two targets for step 2.

**Superseded in part by §10 below.** The sequencing above assumes one design system. It turns
out there are two, and which one wins is a prior decision. Read §10 first.

---

## 10. RETRACTED — "two contradictory design systems"

**An earlier revision of this document claimed the canvas studio violated `DESIGN-DNA.md`'s
"no drop shadows / no gradients / radius 0" rules. That claim was wrong and is withdrawn.**

The error: I applied a spec outside its scope. `DESIGN-DNA.md` is the **app-shell and widget**
language shared between mobile and web — its subject is the home/dashboard widget register
("widget cards", "widget settings panel", "Mobile is the shorter sibling: same widgets in a
horizontal scroll"). It mentions the canvas exactly three times, all incidental (a north-arrow
glyph, a scale bar, a widget panel). Its "no drop shadows on **cards**" rule is about
dashboard widget cards. It was never a canvas rule.

### 10.1 The canvas has its own binding spec, and the studio follows it

`docs/STUDIO-STYLING-AND-UX.md` — titled **"Studio styling and UI/UX logic (binding)"** — is
the governing document for canvas chrome. It does not merely permit the treatments I flagged;
**it mandates them**:

- **Glass rule** (`:108-115`): *"Large floating panels must read as frost, not drywall. Prefer
  `--hc-glass-soft` + `backdrop-filter` for popups and docks."* The 55 files using
  `backdrop-filter` are compliance, not drift.
- **Dock control language (binding)** (`:95-106`): micro controls use a *"neumorphic
  soft-plastic"* language — `--hc-neu-raised` + `--hc-neu-out-sm`, pressed = `--hc-neu-in`.
  Shadow **is** the specified idiom.
- **Elevation tokens** (`:82`): `--hc-elev-*`, described as *"soft ink shadow, not slate."*
- Its own **Forbidden looks** list (`:86-93`) bans *"multi-layer neon shadows"* and *"opaque
  solid panels that read as a second app chrome bar"* — not shadows as such.
- It even manages cross-spec overrides explicitly: §0.1 carries the heading *"Frame control
  language (**overrides the neu-plastic chip rule**)."*
- Studio fonts are **Fraunces / Sora / IBM Plex Mono** (`:84`) — deliberately distinct from
  the shell's IBM Plex family.

The two specs are **scoped, not contradictory.** Shell and canvas are intentionally different
registers. The `vicGovChips` "instrument dial" treatment sits inside the dock control language,
and at `color-mix(… 90%, transparent)` + blur it satisfies the glass rule's own limit (*"avoid
0.94+ full-width bars"*).

### 10.2 The corrected — and more useful — finding

Almost every critique in the original brief is **already written down in this repo as binding
policy**. `STUDIO-STYLING-AND-UX.md` §6 is a pre-merge checklist requiring a **yes to every
item or do not merge**:

| Checklist item | The critique it already encodes |
|---|---|
| 1. *"idle CAD view shows mostly drawing, no fixed inventory bar"* | "the canvas is the hero, chrome is quiet" |
| 3. *"chrome is frost / dock plastic — not opaque dark pills or drywall slabs"* | panel treatment consistency |
| 5. *"idle CAD left edge shows **one** tool dock — no glyph stack or duplicate Undo/Redo floating beside it"* | the two competing bottom control zones in Sketch |
| 9. *"the ribbon is a fixed budget, not a landing strip — a new top-level toggle needs the same justification as a new page"* | header/nav overcrowding |
| 11. *"degrade invisibly — no reserved blank space, no dead chrome, no extra empty state"* | the Present empty state |
| 14. *"dormant identical to pre-feature; idle canvas unchanged"* | canvas litter |
| 16. *"gesture, pointer AND keyboard"* | a11y on canvas controls |

Plus **Annotation voice** (`:362-367`): hand-lettered plan notes use *Architects Daughter*,
annotation-only, *"do not apply it to chrome, HUD, or body copy"*, and *"leaders follow the
planting line-weight ladder (0.4)"* — so even the ink-tier idea is partly specified already.

**So the finding is not "there is no system" or "the systems conflict." It is:**

> The specs are good and say the right things. The shipped UI has drifted from them, and
> nothing enforces them. The §6 checklist is a manual merge gate in a markdown file, and
> `apps/web` has never been linted (`OUTSTANDING.md:173-178` — its lint script is `echo ok`).

That reframes the work from "design a new system" to **"close the gap between the spec that
exists and the UI that shipped, then make the spec enforceable in CI."** Materially cheaper,
and far more likely to survive contact with the codebase.

The revision history at `STUDIO-STYLING-AND-UX.md:373-375` shows the pattern already
repeating: the doc was *"written after canvas inventory was incorrectly shipped as a fixed
opaque bottom overlay."* A spec was written in response to drift; drift recurred; nothing
mechanical prevents the next one.

### 10.3 What survives from the retracted section

Three sub-findings stand on their own and are unaffected by the error:

**Adoption is enforced for colour but nothing else.** `check-handoff-chrome-colors.mjs` is a
real CI gate against raw hex in handoff modules — which is exactly why token adoption measures
99% (§0.1). No equivalent gate exists for z-index (63 raw escapes, §0.2), radius (10 arbitrary
values), or opacity (10 ad-hoc values, §4.1). **The colour gate is the proof that this approach
works here; the plan should replicate it for the other three axes.**

**`apps/web` does not import `@workstream/ui`.** The only reference is a comment at
`styles/globals.css:3`. `packages/ui/src/tokens.ts` calls itself *"Workstream Design System 4.0
— one token source consumed by both apps/mobile (RN) and apps/web (CSS alias)"*, but web
re-declares rather than consumes. Whether that matters depends on whether shell and canvas are
*meant* to share tokens — an open question, not a defect.

**The chrome is e2e-locked.** 46 specs in `apps/web/e2e/`, several asserting current chrome:
`instrument-dial.spec.ts`, `canvas-chrome-parenting.spec.ts`, `canvas-lane-law.spec.ts`,
`canvas-chrome-detector.spec.ts`, `canvas-chrome-screenshots.spec.ts`, plus the
`canvas-contrast-aa.spec.ts` gate at zero. Any chrome change budgets for probe updates.
`OUTSTANDING.md:142-151` sets the precedent — two strips were left mis-parented because specs
asserted the current behaviour, and the doc calls that *"a product decision, not a bug fix."*

### 10.4 Method note

I asserted a cross-document contradiction after reading one of the two documents. The scoping
statement that would have prevented it was in the title of the other. **Before claiming any UI
violates a spec, confirm that spec governs that surface** — this repo has 63 design docs and
they are deliberately scoped to different surfaces.

---

## 11. Prior art — do not start from scratch

`docs/` contains **63 markdown files**, several directly covering this ground. Any plan that
ignores them will duplicate or contradict existing decisions. At minimum, read:

| Doc | Why |
|---|---|
| `DESIGN-DNA.md` | Spec A, above |
| `STUDIO-STYLING-AND-UX.md` (20KB) | Studio-specific styling decisions |
| `MASTER-GAP-ANALYSIS-2026-08-02.md` (20KB) | Two days old; likely overlaps this audit |
| `TIER1-UX-E2E-GAP-ANALYSIS-2026-08-02.md` (34KB) | Largest gap doc in the repo |
| `HANDOVER-2026-08-02-STUDIO-UX.md` | Most recent studio UX handover |
| `CANVAS-FIRST-SCREENSHOT-ISSUES.md` | Screenshot-driven issue list — same method as this audit |
| `CAD-AI-2026-UX.md` | The 2026 UX direction already on file |
| `COLOR-TOKENS.md`, `DESIGN-KIT-INVENTORY.md`, `STUDIO-SURFACES.md` | System inventories |
| `docs/design-returns/2026-07-27-canvas-ux-strategy.md` | External designer's canvas strategy |
| `docs/design-returns/2026-07-27-visual-system-and-library.md` | External designer's visual system |
| `docs/design/operator-redesign/` | Pre-existing design work in this very folder |

`docs/design-returns/` holds seven briefs from an external designer dated 2026-07-27,
including a canvas UX strategy and a visual system. **Someone has already been paid to think
about this.** Reconcile with it before commissioning a new plan.

---

## 12. Known issues the team has already logged

From `OUTSTANDING.md`. Several overlap this audit — credit where due, and do not re-file them:

- **Quote table crowding is already logged** (`OUTSTANDING.md:168-172`), including the exact
  symptom I flagged: `grid-template-columns: 1fr 36px 72px 84px 108px minmax(120px,180px)`
  runs TOTAL and ACTIONS together with no gutter, and *"a long unit note ('~1.73 t spoil · 8
  t/load') bleeds into the actions column."* Noted as needing "a measured pass rather than a
  token swap."
- **Canvas WCAG 2.2 AA contrast is DONE and gated** (`:152-162`). 23 failures across 22 rules
  found and fixed; `canvas-contrast-aa.spec.ts` is at zero. **Do not put "fix contrast" in the
  plan** — it is solved and guarded. Useful house rule recorded there: *"accents are top bars,
  not fills."*
- **`apps/web` is not linted at all** (`:173-178`). Root `pnpm lint` covers only
  `apps/api/src packages/domain/src packages/contracts/src`; `apps/web`'s own lint script is
  literally `echo ok`. No ESLint has ever run over the largest surface in the repo, including
  every canvas feature. The doc warns: *"expect a large first-run backlog."* **This is a
  prerequisite for my §9.2 lint-guard recommendation, and it is much bigger than I assumed.**
- **Double-portal chrome bug, partially fixed** (`:132-151`). `ArtboardStrip` was escaping its
  `FrameDrawer` because it kept a `CameraChrome place="dock"` wrapper that portaled it back
  out to `camera-chrome-root`, landing it mid-drawing. Fixed in `ebf1872`, probe kept at
  `e2e/elevation-callout-hit.spec.ts`. **`GardenViewpointStrip` and `VariationFilmstrip` still
  have the identical bug and were left deliberately** because e2e specs assert they float on
  the canvas. This is the mechanical cause of part of the "floating panel chaos" — it is a
  known, named, half-fixed bug, not purely a design choice.
- **`dashboard-filter-sort.spec.ts` is stale** (`:163-167`) — 2 of 5 tests red on a clean tree
  since the `/home` editorial redesign.
- Storybook (`:114`) and a bundle-size budget (`:116`) are both open.
