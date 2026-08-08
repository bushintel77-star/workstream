# Cursor Agent Brief — Aerial Design Studio Redesign

> **Audience:** Autonomous coding agent (Cursor). Execute this brief end to end without
> further instruction unless a STOP condition is hit. Work in small, reviewable commits.

### Agent context (read first)

- **Repo:** Workstream / Aegis monorepo — **not** the Curtis brand spec in §1 below (that
  block is legacy; superseded by product decision **B**).
- **Studio code:** `apps/web` only → deploys to **`web-production-3c194`** on Railway. See
  `RECON.md` and `DEPLOY.md`.
- **Three deploy surfaces:** `apps/api`, `apps/web`, `apps/mobile` — not two. Do not
  assume studio ships via API or mobile.
- **Brand (locked):** `@workstream/ui` + `apps/web/src/styles/globals.css` — achromatic +
  single `--accent` (`#C2410C`), ≤3% signal surface (Save + armed mode). Walkthrough §3.2.
- **Mapbox:** Static aerial image only; scale from `apps/web/src/lib/mapView.ts`. No
  Mapbox GL.
- **CI / infra (out of scope):** Do **not** change `.github/workflows/ci.yml` or
  Railway service config to "fix" deploy. Railway auto-deploys on push to `main`.
- **Phase 6 AI:** Skip implementation this run; write approach to `PROPOSAL.md` only if
  scheduled. `ANTHROPIC_API_KEY` on API is optional future plumbing, not a green light.

### Re-sequenced execution (2026-05-22)

| Phase | Status |
|-------|--------|
| 2 Brand re-skin (Aegis tokens) | **Shipped** (`80e7c07`) — human review before layout |
| 3 Layout | Next |
| 4 Planning palette + search by code | |
| 5 Modeless canvas + scale bar | |
| 7 States, honesty UI, a11y | |
| 8 Docs + E2E | |
| 6 AI detection | **Skipped** (proposal only) |

---

## 0. Mission

Redesign the **Aerial Design Studio** — the in-house back-of-envelope sketch tool where a
Curtis & Co designer drops symbols (trees, lawn, paving, structures, plus two TRP/council
planning symbols) onto a Mapbox aerial of a client site, then saves a concept plan that
feeds an envelope estimate on the Design page.

Take it from "functional internal tool" to gold standard, applying 2026 modeless / AI-assist
interaction logic — **without** letting the tool over-promise as a construction drawing.

This is a **concept estimating tool, not CAD.** Programmatic drawing is categorically not a
substitute for a draftsperson. The redesign must make that limit legible, not hide it.

---

## 1. Hard constraints (do not violate)

- **Brand system is locked.** Cormorant Garamond (headings) + DM Mono (labels, codes,
  numeric readouts). Surface: Deep Canopy base. Palette: bone, arabica timber, corten,
  deep canopy green, burnt sienna. **Exactly one accent** (corten / burnt sienna), used on
  ≤5% of surface area — armed state and the Save action only. No new colours.
- **No hex literals in component styles.** All colour via design tokens / CSS variables.
  If a no-hex lint rule exists, keep it passing; if it doesn't cover CSS files, that is a
  known gap — do not rely on it, self-check.
- **2D top-down only.** Do NOT add 3D, tilt, isometric, or photoreal generative views —
  these imply construction-grade accuracy the tool must never claim.
- **AI is suggestion-only.** Nothing AI-placed may silently enter the saved plan. Every
  AI element renders in a distinct ghost style until explicitly confirmed by the user.
- **Do not touch estimate logic.** This task is UI/UX + placement interaction only. The
  envelope estimate on the Design page is out of scope; only ensure the saved plan
  payload carries the data the estimator already expects (asset codes, counts, geometry).
- **No new heavy dependencies** without flagging first (see STOP conditions). Mapbox GL,
  the existing component/UI package, and the existing state layer are the allowed surface.

---

## 2. Scope — in / out

**In scope**
- Layout: aerial-as-hero, fixed right rail (~320px), slim top toolbar, no dead black space.
- Re-skin to Aegis / `@workstream/ui` tokens (see agent context; §1 legacy text superseded).
- Asset library: contrast fixes, consistent asset codes on every tile, search by name+code,
  category chips without the horizontal scrollbar, pinned "Planning" group for TRP symbols.
- Modeless / intent-aware canvas: click-empty-with-asset = place, click-symbol = select,
  drag-empty = marquee/pan; mode bar demoted to fallback.
- Symbol manipulation: select / move / rotate / scale / delete handles.
- TPZ symbol resizable with an indicative metre readout (labelled "indicative only").
- Indicative scale bar derived from static aerial bounds (`mapView.ts`).
- AI assist layer (suggestion-only): aerial detection ghosts for building / trees / paving;
  `Cmd+K` command bar for bulk placement and "estimate this plan".
- States: empty canvas prompt, Mapbox load failure + retry, saving spinner + success/fail.
- Honesty UI: permanent "concept sketch — not a construction drawing" caption; save
  confirmation with draftsperson hand-off line; TPZ advisory.
- Accessibility: WCAG AA contrast on all text, full keyboard path, visible focus rings,
  screen-reader labels, `prefers-reduced-motion` respected.
- Keyboard shortcuts + discoverable legend.

**Out of scope**
- The envelope estimate calculation itself.
- 3D / immersive / photoreal rendering.
- Backend / API changes beyond the saved-plan payload shape.
- Authentication, routing outside the Studio + Design pages.
- **CI, Railway service config, workflow edits** — deploy is human/infra (`DEPLOY.md`).
- **Mobile** `apps/mobile` design studio — separate surface; do not block web phases on it.

---

## 3. Execution plan (work in this order, one commit per phase)

### Phase 1 — Recon (no code changes)
- Locate the Studio component(s), the Mapbox integration, the asset library data source,
  the design-token / theme file, and the saved-plan payload type.
- Produce `RECON.md` in the working dir: file map, current state-management approach,
  where modes live, where assets are defined, where Save writes.
- **STOP and report** if: no design-token file exists, the asset list is hardcoded with no
  single source of truth, or the saved-plan type is undocumented.

### Phase 2 — Brand re-skin (visual only, no behaviour change) — **DONE**
- Apply **Aegis / `@workstream/ui`** tokens via CSS variables (see agent context).
- Unify asset tiles to one card treatment; category shown by a small chip, not whole-tile tint.
- **Fix all contrast failures** — faint asset labels on tinted tiles currently fail AA.
- Glassy floating chrome: subtle backdrop blur + soft shadow on toolbar/panels over the aerial.
- Commit: `redesign(web): apply Aegis tokens to design studio`

### Phase 3 — Layout
- Aerial fills available height; right rail fixed ~320px; slim top toolbar.
- Remove the dead black space below the map and the in-canvas orange Save bar.
- Move Save to the toolbar (top-right) as the single filled accent button, with autosave
  status text beside it ("All changes saved 12:04").
- Group destructive actions (Undo / Clear markup / Clear symbols), de-emphasised, right side.
- Commit: `redesign: aerial-hero layout, toolbar consolidation`

### Phase 4 — Asset library
- Search filters live on name + asset code.
- Asset code (`PLT-HORN` style) shown on **every** tile, not just one.
- Category chips (`All / Planting / Hardscape / Structures / Planning`) as a clean
  segmented/wrapping row — remove the horizontal scrollbar; only the vertical list scrolls.
- New pinned **Planning** group: `Tree protection zone` + `Existing tree (retain)`,
  dashed-outline / hatch treatment, "TRP" tag, visually distinct from decorative assets.
- Commit: `redesign: asset library legibility, codes, planning group`

### Phase 5 — Modeless canvas + manipulation
- Implement intent-aware canvas: place / select / marquee-pan inferred from target + state.
- Demote the mode bar to a fallback control.
- Pointer-aware floating context label ("Place Olive standard" / "Move TPZ").
- Selection handles: move, rotate, scale, delete. `Delete` key removes selection, `Esc` cancels.
- TPZ resizable; show indicative metre value labelled "indicative only".
- Indicative scale bar from static aerial bounds (`mapView.ts`), not Mapbox GL zoom.
- Support both drag-from-library and click-to-place.
- Commit: `feat: modeless canvas, symbol manipulation, scale reference`

### Phase 6 — AI assist (suggestion-only) — **DEFERRED THIS RUN**
- Do **not** implement detection or command bar in this pass.
- If asked later: write `PROPOSAL.md` only (approach, cost, libraries) — **STOP** before
  adding any model/SDK. Optional API secret `ANTHROPIC_API_KEY` does not authorize shipping.
- Original scope (ghosts, `Cmd+K`, etc.) remains in §2 for a future pass.

### Phase 7 — States, honesty UI, a11y, shortcuts
- Empty canvas centred prompt; Mapbox failure state + retry; Save spinner + success/fail.
- Permanent caption: "Concept sketch for estimating — not a construction drawing."
- Save confirmation: "Saved — concept ready for envelope estimate. Send to draftsperson
  for working drawings."
- TPZ advisory when a TPZ symbol is present: confirm against arborist report / council.
- Confirm dialog on Clear markup / Clear symbols ("Clear 4 symbols?") or make them undoable.
- Keyboard: `P` Place, `D` Draw, `V` Select, `Ctrl/Cmd+Z` Undo, `Cmd+K` command bar,
  `Esc` cancel, `Delete` remove selected — plus a discoverable legend.
- Visible focus rings, screen-reader labels on every asset and handle, `prefers-reduced-motion`.
- Motion: 120–180ms spring-eased transitions; settle, not bounce.
- Commit: `feat: states, honesty UI, accessibility, keyboard shortcuts`

### Phase 8 — Verify & hand off
- Run the full check sequence in section 4.
- Update `RECON.md` → `CHANGES.md`: what changed, any deviations, any STOP items raised.
- Final commit: `chore: verification pass + changelog`

---

## 4. Acceptance gates (all must pass before hand-off)

**Automated**
- [ ] Typecheck clean.
- [ ] Lint clean (including any no-hex rule).
- [ ] Existing test suite passes; no regressions.
- [ ] Build succeeds.
- [ ] No new dependency added without a flagged STOP.

**Functional self-check**
- [ ] Aerial fills the screen; no dead black space; no in-canvas Save bar.
- [ ] Every asset tile shows a readable name AND an asset code.
- [ ] Search matches name and code.
- [ ] Planning group is pinned and contains both TRP symbols, visually distinct.
- [ ] Canvas is modeless: place / select / marquee-pan work without switching modes.
- [ ] Symbols can be moved, rotated, scaled, deleted; TPZ resizes with an indicative metre value.
- [ ] AI ghosts are visibly suggestions, explainable on hover, never auto-saved.
- [ ] `Cmd+K` command bar places assets and triggers an estimate.
- [ ] Empty / Mapbox-failure / saving states all render correctly.
- [ ] Permanent "not a construction drawing" caption present; save confirmation carries the
      draftsperson hand-off line.
- [ ] Saved-plan payload still carries asset codes, counts, and geometry the estimator expects.

**Brand / a11y**
- [ ] All text passes WCAG AA contrast (verify the previously-faint asset labels specifically).
- [ ] Only one accent colour used; ≤3% signal surface (Save + armed mode).
- [ ] Inter / Inter Display / JetBrains Mono per `globals.css` — no stray fonts.
- [ ] No hex literals in component styles.
- [ ] Full keyboard path; visible focus rings; `prefers-reduced-motion` honoured.

---

## 5. STOP conditions — pause and report, do not guess

Raise a report and wait for a human before proceeding if any of these occur:
1. No single source of truth for design tokens or for the asset list.
2. The saved-plan payload type is undocumented or ambiguous.
3. AI detection requires a new library/model — propose the approach and cost first.
4. Any change would touch the envelope estimate calculation.
5. The brand system as specified conflicts with what's actually in the codebase.
6. A required Mapbox capability (e.g. zoom-to-metres) is not available on the current plan/SDK.
7. Achieving an acceptance gate would require a dependency not already present.
8. You are tempted to “fix” CI web deploy or Fly secrets — **do not**; report and continue
   UI work; human owns infra per `DEPLOY.md`.

---

## 6. Working discipline

- Small commits, one per phase, with the commit messages given above.
- Never delete user work paths — Clear actions must be confirmable or undoable.
- Prefer extending the existing component/UI package over inventing new primitives.
- Leave `CHANGES.md` accurate and complete; list every deviation from this brief.
- If unsure whether something is in scope, check section 2 — if still unsure, STOP and ask.
