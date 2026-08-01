# TIER-1 UX GAP & E2E ANALYSIS — 2026-08-02

> **Comprehensive audit of every screen, button, colour token, feature, and user flow.**
> Supersedes all prior gap audits. Live source of truth.

---

## 1. SCREEN INVENTORY (36 routes)

### Public surfaces (4)

| Route | File | Status | Tier-1 gaps |
|-------|------|--------|-------------|
| `/` | `app/page.tsx` | ✅ Live | Landing hero visual, 2 CTAs, privacy footer. **Missing:** OG image, structured data, favicon set incomplete (SVG only, no PNG fallback) |
| `/legal/privacy` | `app/legal/privacy/page.tsx` | ✅ Live | Static content. **Missing:** last-updated date, printable layout |
| `/legal/terms` | `app/legal/terms/page.tsx` | ✅ Live | Static content. **Missing:** last-updated date, printable layout |
| `/sign-in/[[...sign-in]]` | Clerk hosted | ✅ Live | Clerk-managed. **Missing:** branded redirect URL, post-sign-in deep-link |

### Operator surfaces (3)

| Route | File | Status | Tier-1 gaps |
|-------|------|--------|-------------|
| `/home` | `app/home/page.tsx` | ✅ Live | Dashboard with project grid, filters, sort, search. **Now has:** Dialog delete confirm, Popover actions, SkeletonRow loading, card hover lift. **Missing:** keyboard shortcut help (?), empty-state illustration is placeholder SVG, no bulk-select |
| `/confirm-pin` | `app/confirm-pin/page.tsx` | ✅ Live | PIN confirmation for new projects. **Missing:** back button, error retry count |
| `/sign-up/[[...sign-up]]` | Clerk hosted | ✅ Live | Clerk-managed. Same gaps as sign-in |

### Project surfaces (14)

| Route | File | Status | Tier-1 gaps |
|-------|------|--------|-------------|
| `/projects/[id]` | `app/projects/[id]/page.tsx` | ✅ Live | **The studio** — HandoffDesignStudio with StudioSkeleton fallback. **Now has:** view transitions, z-index tokens. **Missing:** keyboard mode-switch shortcuts (1/2/3/4), breadcrumb trail, unsaved-changes guard |
| `/projects/[id]/overview` | `app/projects/[id]/overview/page.tsx` | ✅ Live | Project overview. **Missing:** skeleton loading, edit-in-place for project name |
| `/projects/[id]/survey` | `app/projects/[id]/survey/page.tsx` | ✅ Live | Survey data entry. **Missing:** progress indicator, auto-save indicator |
| `/projects/[id]/measurements` | `app/projects/[id]/measurements/page.tsx` | ✅ Live | Measurement list. **Missing:** export CSV, bulk-edit |
| `/projects/[id]/design` | `app/projects/[id]/design/page.tsx` | ✅ Live | Design phase hub. **Missing:** phase progress bar |
| `/projects/[id]/design/cad` | `app/projects/[id]/design/cad/page.tsx` | ✅ Live | CAD detail. **Missing:** DXF download button |
| `/projects/[id]/design/develop` | `app/projects/[id]/design/develop/page.tsx` | ✅ Live | Develop loop. **Missing:** version diff view |
| `/projects/[id]/design/studio` | `app/projects/[id]/design/studio/page.tsx` | ✅ Live | Studio sub-page. **Missing:** breadcrumb back to project |
| `/projects/[id]/costing` | `app/projects/[id]/costing/page.tsx` | ✅ Live | Cost breakdown. **Missing:** export PDF, margin editor |
| `/projects/[id]/carbon` | `app/projects/[id]/carbon/page.tsx` | ✅ Live | Carbon ledger. **Missing:** comparison baseline, chart visualisation |
| `/projects/[id]/audit` | `app/projects/[id]/audit/page.tsx` | ✅ Live | Audit trail. **Missing:** filter by actor, date range |
| `/projects/[id]/outputs` | `app/projects/[id]/outputs/page.tsx` | ✅ Live | Output files. **Missing:** drag-to-reorder, preview thumbnails |
| `/projects/[id]/tasks` | `app/projects/[id]/tasks/page.tsx` | ✅ Live | Task list. **Missing:** kanban view, assignee filter |
| `/projects/[id]/recordings` | `app/projects/[id]/recordings/page.tsx` | ✅ Live | Voice recordings. **Missing:** waveform scrubber, transcript inline |
| `/projects/[id]/filing` | `app/projects/[id]/filing/page.tsx` | ✅ Live | Filing cabinet. **Missing:** folder nesting, drag-drop |
| `/projects/[id]/processing` | `app/projects/[id]/processing/page.tsx` | ✅ Live | Processing status. **Missing:** progress bar, cancel button |

### Settings surfaces (8)

| Route | File | Status | Tier-1 gaps |
|-------|------|--------|-------------|
| `/settings` | `app/settings/page.tsx` | ✅ Live | Settings hub. **Missing:** search settings, unsaved-changes indicator |
| `/settings/crew` | `app/settings/crew/page.tsx` | ✅ Live | Crew management. **Now has:** Dialog remove confirm. **Missing:** role badges, invite flow |
| `/settings/accounting` | `app/settings/accounting/page.tsx` | ✅ Live | Accounting config. **Missing:** GST toggle, Xero sync status |
| `/settings/rate-card` | `app/settings/rate-card/page.tsx` | ✅ Live | Rate card editor. **Missing:** CSV import, version history |
| `/settings/suppliers` | `app/settings/suppliers/page.tsx` | ✅ Live | Supplier list. **Missing:** contact card, lead-time field |
| `/settings/plant-palette` | `app/settings/plant-palette/page.tsx` | ✅ Live | Plant palette. **Missing:** climate-zone filter, search |
| `/settings/design-assets` | `app/settings/design-assets/page.tsx` | ✅ Live | Design assets. **Missing:** drag-drop upload, preview grid |
| `/settings/license` | `app/settings/license/page.tsx` | ✅ Live | License management. **Missing:** seat count, expiry countdown |

### Client-facing portal surfaces (5)

| Route | File | Status | Tier-1 gaps |
|-------|------|--------|-------------|
| `/portal/quote/[token]` | `app/portal/quote/[token]/page.tsx` | ✅ Live | Client quote portal. **Now has:** print CSS. **Missing:** accept-flow animation, deposit progress, email share button |
| `/portal/deposit/[token]` | `app/portal/deposit/[token]/page.tsx` | ✅ Live | Deposit payment. **Missing:** card brand icons, receipt download |
| `/portal/deposit-success` | `app/portal/deposit-success/page.tsx` | ✅ Live | Success confirmation. **Missing:** receipt PDF, calendar invite |
| `/portal/deposit-cancel` | `app/portal/deposit-cancel/page.tsx` | ✅ Live | Cancel confirmation. **Missing:** retry button, contact link |
| `/share/[token]` | `app/share/[token]/page.tsx` | ✅ Live | Share twin viewer. **Missing:** fullscreen toggle, comment pins |

### Error/loading surfaces (2)

| Route | File | Status | Tier-1 gaps |
|-------|------|--------|-------------|
| `error.tsx` | `app/error.tsx` | ✅ Live | Error boundary with digest ref. **Missing:** error illustration, report button |
| `loading.tsx` | `app/loading.tsx` | ✅ Live | Dashboard skeleton. **Missing:** branded skeleton (uses generic lines) |

---

## 2. BUTTON & INTERACTIVE ELEMENT AUDIT

### Shared UI primitives (`apps/web/src/components/ui/`)

| Component | Variants | Status | Tier-1 gaps |
|-----------|----------|--------|-------------|
| `Button` | primary, secondary, ghost, danger × sm/md/lg | ✅ New | **Missing:** icon-only variant, tooltip prop, aria-busy |
| `Dialog` | default, destructive | ✅ New | **Missing:** size prop (sm/md/lg), non-destructive title icon |
| `Popover` | align left/right | ✅ New | **Missing:** submenu nesting, keyboard arrow navigation |
| `Skeleton` | sm/md/lg/full + SkeletonRow | ✅ New | **Missing:** circle variant (avatar), text line variant |

### Legacy buttons still in use (not yet migrated to shared `Button`)

| Location | Pattern | Count | Migration needed |
|----------|---------|-------|------------------|
| `app.module.css` `.btn` | Raw `<button className={s.btn}>` | ~15 sites | Should use `<Button variant="secondary">` |
| `app.module.css` `.btnDanger` | Raw `<button className={`${s.btn} ${s.btnDanger}`}>` | ~4 sites | Should use `<Button variant="danger">` |
| `app.module.css` `.btnGhost` | Raw `<button className={`${s.btn} ${s.btnGhost}`}>` | ~6 sites | Should use `<Button variant="ghost">` |
| `submit-button.module.css` | `<SubmitButton>` wrapper | ~8 sites | Should compose `<Button loading>` |
| `home.module.css` `.emptyCta` | Raw `<a className={home.emptyCta}>` | 1 site | Should use `<Button as="a" variant="primary">` |
| `landing.module.css` `.primary`/`.secondary` | Raw `<Link>` | 2 sites | Should use `<Button as="a">` |
| Portal quote `quote.module.css` | Raw `<button>`/`<a>` | ~6 sites | Should use `<Button>` |

**Total: ~42 button instances not yet using shared `Button` component.**

### `data-testid` coverage

- **512 `data-testid` attributes** across 121 component files
- **40 E2E spec files** covering major flows
- **34 unit test files** in web components
- **47 unit test files** in domain package

---

## 3. COLOUR TOKEN AUDIT

### Token architecture (3 layers)

```
color-tokens.css    → Raw palette (gray-l/d, crimson, cobalt, forest, slate, sprout, sage, hedge, olive, soil, mulch, bluestone, concrete, timber, water, gravel, lawn, APWA)
globals.css         → Semantic tokens (surface-*, ink-*, line-*, accent-*, signal, ok/warn/block/info, font-*, text-*, s-*, r-*, elev-*)
handoffStudio.css   → Studio chrome tokens (--hc-*, --ws-*, --sds-*)
```

### Surface tokens (dark grey identity)

| Token | Value | Used by | Tier-1 issue |
|-------|-------|---------|--------------|
| `--surface-base` | `#14171C` | Body background, frame | ✅ AA contrast with `--ink-primary` |
| `--surface-elevated` | `#1B1E24` | Cards, panels, buttons | ✅ AA contrast |
| `--surface-sunken` | `#0F1115` | Inset areas, skeleton shimmer | ✅ |
| `--surface-inverted` | `#E8E9EC` | Inverted text on accent | ✅ |
| `--surface-overlay` | `#1B1E24` | Modals, overlays | ⚠️ Same as elevated — no visual distinction between card and overlay |
| `--surface-panel` | `#1B1E24` | Panel background | ⚠️ Same as elevated |

**Gap:** `--surface-overlay` and `--surface-panel` are identical to `--surface-elevated`. Tier-1 apps distinguish overlay (z-1000+) from card (z-20) with a slightly lighter surface. Recommend `--surface-overlay: #20242B` (matches `--gray-d-150`).

### Ink tokens

| Token | Value | Contrast on `--surface-base` | Status |
|-------|-------|------------------------------|--------|
| `--ink-primary` | `#E8E9EC` | 14.8:1 | ✅ AAA |
| `--ink-secondary` | `#9AA0AC` | 5.8:1 | ✅ AA |
| `--ink-tertiary` | `#6B7078` | 3.2:1 | ⚠️ Below AA for normal text — OK for large text / non-text only |
| `--ink-inverted` | `#1B1E23` | On accent only | ✅ |

**Gap:** `--ink-tertiary` at 3.2:1 fails WCAG AA for text < 18px. Used for `--text-muted` in several places. Recommend bumping to `#7A8088` (4.1:1).

### Accent tokens

| Token | Value | Purpose | Status |
|-------|-------|---------|--------|
| `--accent` | `#5A789B` | Blueprint slate — buttons, links | ✅ AA on dark |
| `--accent-bright` | `#7B9BC4` | Hover, portal accent | ✅ |
| `--accent-soft` | `#1E2A38` | Accent backgrounds | ✅ |
| `--accent-ink` | `#8BA4C4` | Accent text | ✅ |
| `--signal` | `#E65416` | Single hero annotation spark | ✅ Used sparingly |

### Semantic tokens

| Token | Value | Status |
|-------|-------|--------|
| `--ok` | `#4C9662` | ✅ AA on dark |
| `--warn` | `#D4A017` | ✅ AA on dark |
| `--block` | `#C4463B` | ✅ AA on dark |
| `--info` | `#6E93E0` | ✅ AA on dark |

### Canvas plan tokens (colour-tokens.css)

| Token | Value | Purpose | Status |
|-------|-------|---------|--------|
| `--existing-stroke` | `--crimson-d-500` (#C4463B) | Existing structures | ✅ |
| `--proposed-stroke` | `--cobalt-d-500` (#3D6BE0) | Proposed geometry | ✅ |
| `--planting-retain-stroke` | `--forest-d-550` (#328052) | Retained planting | ✅ |
| `--planting-new-stroke` | `--sprout-d-400` (#5CA871) | New planting | ✅ |
| `--easement-stroke` | `--slate-d-400` (#6E93E0) | Easements | ⚠️ Very close to `--proposed-stroke` — may confuse |
| `--canvas` | `--gray-d-0` (#0F1115) | Canvas background | ✅ |

**Gap:** `--easement-stroke` (#6E93E0) and `--proposed-stroke` (#3D6BE0) are both blue and only 18° apart in hue. On a dense plan with both easements and proposed geometry, they're hard to distinguish. Recommend shifting easement to `--slate-d-400` → `#8BA4C4` (lighter, more clearly distinct).

### Type scale tokens

| Token | Value | Line-height | Status |
|-------|-------|-------------|--------|
| `--text-micro` | 10px | 14px | ✅ |
| `--text-xs` | 11px | 16px | ✅ |
| `--text-sm` | 13px | 18px | ✅ |
| `--text-base` | 15px | 22px | ✅ |
| `--text-md` | 17px | 24px | ✅ |
| `--text-lg` | 20px | 28px | ✅ |
| `--text-xl` | 24px | 32px | ✅ |
| `--text-2xl` | 32px | 38px | ✅ |
| `--text-3xl` | 42px | 48px | ✅ |

**Gap:** Type scale tokens are defined but **not yet referenced by any component**. All existing components use hardcoded `font-size` values. Migration needed.

### Z-index tokens (15 layers)

| Token | Value | Status |
|-------|-------|--------|
| `--ws-z-base` through `--ws-z-fullscreen` | 0–80 | ✅ All 152 raw values tokenized |

---

## 4. FEATURE AUDIT (studio canvas — 55+ features)

### Survey mode

| Feature | Component | Test | Status |
|---------|-----------|------|--------|
| Aerial underlay | `AerialSlot.tsx` | `aerialDropCue.test.ts` | ✅ |
| Title boundary (Vicmap WFS) | `FitSheetOverlay.tsx` | E2E `easement-honesty.spec.ts` | ✅ |
| Survey annotations | `SurveyAnnotationLayer.tsx` | — | ⚠️ No unit test |
| Drainage runs | `DrainageRunsLayer.tsx` | `drainage-runs.test.ts` (domain) | ✅ |
| TPZ canopy discs | `CadPlanBoard.tsx` | `studio-preemptive-compliance.test.ts` | ✅ |
| Keyless wash (planning/bushfire/contour/flood/heritage) | `KeylessOverlayWash.tsx` | — | ⚠️ No unit test |
| Vic-gov status chips | `vicGovChips.module.css` | E2E `vic-gov-status-chips.spec.ts` | ✅ |
| Environment panel (sticky meta) | `EnvironmentPanel.tsx` | `envLiveMeta.test.ts` | ✅ |
| Trees meta panel | `TreesMetaPanel.tsx` | — | ⚠️ No unit test |
| Site live meta | `siteLiveMeta.ts` | `siteLiveMeta.test.ts` | ✅ |

### Sketch mode

| Feature | Component | Test | Status |
|---------|-----------|------|--------|
| Brush canvas | `SketchBoard.tsx` | `sketchInput.test.ts` | ✅ |
| Sketch dock (summoned peel) | `SketchDock.tsx` | E2E `sketch-surfaces.spec.ts` | ✅ |
| Image underlay layers | `ImageLayerPanel.tsx` | E2E `sketch-image-layers.spec.ts` | ✅ |
| AI ghost scan | `AiGhostReview.tsx` | E2E `canvas-sketch-ai.spec.ts` | ✅ |
| NL sketch assist | `HandoffDesignStudio.tsx` | — | ⚠️ No unit test for prompt builder |
| Paint swatches | `handoffStudio.module.css` | — | ⚠️ No test |
| Flora ring | `FloraRing.tsx` | E2E `flora-ring-ungate.spec.ts` | ✅ |

### CAD mode

| Feature | Component | Test | Status |
|---------|-----------|------|--------|
| CAD plan board | `CadPlanBoard.tsx` | E2E `canvas-foundation.spec.ts` | ✅ |
| Protractor arc | `ProtractorArc.tsx` | `ProtractorArc.test.ts` | ✅ |
| Selection handles | `SelectionHandles.tsx` | — | ⚠️ No unit test |
| Snap guides + crosshair | `CadPlanBoard.tsx` | `canvas-snap.test.ts` (domain) | ✅ |
| Marquee select | `CadPlanBoard.tsx` | — | ⚠️ No unit test |
| Council path labels | `CadPlanBoard.tsx` | — | ⚠️ No unit test |
| House envelope label | `CadPlanBoard.tsx` | — | ⚠️ No unit test |
| Draft grid studio | `DraftGridStudio.tsx` | — | ⚠️ No unit test |
| Foundation CAD context | `foundationCadContext.ts` | `foundationCadContext.test.ts` | ✅ |
| Plan line styles | `planLineStyles.ts` | `planLineStyles.test.ts` | ✅ |
| Canvas touch camera | `canvasTouchCamera.ts` | `canvasTouchCamera.test.ts` | ✅ |

### Quote mode

| Feature | Component | Test | Status |
|---------|-----------|------|--------|
| Quote builder | `QuoteBuilder.tsx` | E2E `quote-tier1.spec.ts`, `quote-line-items.spec.ts` | ✅ |
| Quote line rows | `QuoteLineRow.tsx` | — | ⚠️ No unit test |
| Quote portal | `QuotePortal.tsx` | E2E `quote-tier1-fortune500.spec.ts` | ✅ |
| Deposit flow | `app/portal/deposit/[token]/page.tsx` | E2E `share-acceptance.spec.ts` | ✅ |

### Share mode

| Feature | Component | Test | Status |
|---------|-----------|------|--------|
| Share surface | `ShareSurface.tsx` | E2E `share-acceptance.spec.ts` | ✅ |
| Client share twin | `ClientShareTwin.tsx` | — | ⚠️ No unit test |
| Share revision popup | `ShareRevisionPopup.tsx` | — | ⚠️ No unit test |
| Safety waiver | `safetyWaiverConfirm.module.css` | `shareLiabilityGate.test.ts` | ✅ |
| Client share decision | `ClientShareDecision.tsx` | — | ⚠️ No unit test |

### Cross-mode features

| Feature | Component | Test | Status |
|---------|-----------|------|--------|
| Command palette (Cmd+K) | `StudioCommandPalette.tsx` | — | ⚠️ No unit test |
| Tool dock | `ToolDock.tsx` | E2E `quote-tool-dock.spec.ts` | ✅ |
| Contextual tool strip | `ContextualToolStrip.tsx` | — | ⚠️ No unit test |
| Canvas context card | `CanvasContextCard.tsx` | — | ⚠️ No unit test |
| Header view menu | `HeaderViewMenu.tsx` | — | ⚠️ No unit test |
| Compact mode nav | `CompactModeNav.tsx` | E2E `canvas-compact-chrome.spec.ts` | ✅ |
| Asset panel | `AssetPanel.tsx` | `leftAssetPanel.test.ts`, `assetCommandRank.test.ts` | ✅ |
| Asset command sheet | `AssetCommandSheet.tsx` | — | ⚠️ No unit test |
| Selection dial | `SelectionDial.tsx` | `dialMath.test.ts` | ✅ |
| Selection focus veil | `SelectionFocusVeil.tsx` | E2E `selection-focus-veil.spec.ts` | ✅ |
| Compliance dock | `ComplianceDock.tsx` | `studio-preemptive-compliance.test.ts` | ✅ |
| BOM dock | `LiveBomDock.tsx` | E2E `zone-bom.spec.ts` | ✅ |
| Sun growth dock | `SunGrowthDock.tsx` | E2E `premium-sun-client.spec.ts` | ✅ |
| Sun cast | `sunCast.module.css` | `plan-sun-cast.test.ts` (domain) | ✅ |
| Shade grid | `shadeGrid.module.css` | — | ⚠️ No unit test |
| Climate bed wash | `climateBedWash.module.css` | — | ⚠️ No unit test |
| Lighting dock | `LightingDock.tsx` | `lv-lighting.test.ts` (domain) | ✅ |
| Lighting beams | `lightingBeams.module.css` | — | ⚠️ No unit test |
| Live measures | `CanvasMeasureSummary.tsx` | `buildMeasureSummary.test.ts` | ✅ |
| Live telemetry | `LiveTelemetryDock.tsx` | `board-telemetry.test.ts` (domain) | ✅ |
| Tilt lens | `tilt.module.css` | E2E `tilt-lens.spec.ts` | ✅ |
| AR birdseye | `ArBirdseyeOverlay.tsx` | `ar-birdseye.test.ts` (domain) | ✅ |
| Elevation board | `ElevationBoard.tsx` | `elevation-projection.test.ts` (domain) | ✅ |
| Plan thumbnail | `planThumbnail.module.css` | — | ⚠️ No unit test |
| Artboard strip | `ArtboardStrip.tsx` | `artboards.test.ts` (domain) | ✅ |
| Fit sheet overlay | `FitSheetOverlay.tsx` | `fit-sheet-edges.test.ts` (domain) | ✅ |
| Sheet compose dock | `SheetComposeDock.tsx` | `SheetFurniture.test.ts` | ✅ |
| Sheet widget stack | `SheetWidgetStack.tsx` | `sheetWidgetContext.test.ts` | ✅ |
| Studio sheet host | `StudioSheetHost.tsx` | `studioSheet.test.ts` | ✅ |
| Presentation render | `AnnotationLayer.tsx` | `annotationLayout.test.ts`, `handDrawnPen.test.ts` | ✅ |
| Render tokens | `renderTokens.test.ts` | `renderTokens.test.ts` | ✅ |
| Species symbols | `SpeciesSymbol.test.ts` | `SpeciesSymbol.test.ts` | ✅ |
| Coach marks | `StudioCoachMarks.tsx` | — | ⚠️ No unit test |
| Layers panel | `LayersPanel.tsx` | — | ⚠️ No unit test |
| Utility drawer | `UtilityDrawer.tsx` | — | ⚠️ No unit test |
| Zone overlay | `ZoneOverlay.tsx` | — | ⚠️ No unit test |
| Irrigation uniformity | `irrigationUniformity.module.css` | `irrigation-uniformity.test.ts` (domain) | ✅ |
| Trench overlay | `TrenchOverlay.tsx` | `auto-trench.test.ts` (domain) | ✅ |
| Path corridors | `PathCorridorsLayer.tsx` | `path-corridor.test.ts` (domain) | ✅ |
| Trace overlay | `TraceOverlay.tsx` | — | ⚠️ No unit test |
| View north control | `ViewNorthControl.tsx` | — | ⚠️ No unit test |
| Garden viewpoint | `gardenViewpoint.module.css` | — | ⚠️ No unit test |
| Phase manager chip | `PhaseManagerChip.tsx` | `design-lifecycle.test.ts` (domain) | ✅ |
| Variation filmstrip | `variationFilmstrip.module.css` | `design-schemes.test.ts` (domain) | ✅ |
| Permit todos | `permitTodos.module.css` | — | ⚠️ No unit test |
| Sustainability | `sustainability.module.css` | `board-sustainability.test.ts` (domain) | ✅ |
| Board findings | `boardFindings.module.css` | `board-findings.test.ts` (domain) | ✅ |
| Preemptive horizon | `preemptiveHorizon.module.css` | — | ⚠️ No unit test |
| Services ledger | `ServicesLedger.tsx` | `serviceLedger.test.ts` | ✅ |
| Site pack panel | `SitePackPanel.tsx` | E2E `site-pack-dig-gate.spec.ts` | ✅ |
| Margin strip | `MarginStrip.tsx` | — | ⚠️ No unit test |
| Data lane slot | `DataLaneSlot.tsx` | E2E `right-data-lane-keyboard.spec.ts` | ✅ |
| Right data lane | `rightDataLane.module.css` | E2E `right-data-lane-keyboard.spec.ts` | ✅ |
| Sticky meta rail | `stickyMeta.module.css` | `envLiveMeta.test.ts` | ✅ |
| Context breadcrumb | `StudioContextBreadcrumb.tsx` | — | ⚠️ No unit test |
| Context strip | `contextStrip.module.css` | — | ⚠️ No unit test |
| Honesty caption | `handoffStudio.module.css` | E2E `easement-honesty.spec.ts` | ✅ |
| Camera chrome | `CameraChrome.tsx` | E2E `canvas-chrome-parenting.spec.ts` | ✅ |
| Chrome idle | `useChromeIdle.ts` | — | ⚠️ No unit test |
| Studio AI engine | `studioAiEngine.ts` | `studioAiEngine.test.ts` | ✅ |
| Studio state | `useStudioState.ts` | `handoffChrome.test.ts` | ✅ |
| Urban tree ingest | `urbanTreeIngest.test.ts` | `urbanTreeIngest.test.ts` | ✅ |
| Niche tools | `nicheTools.ts` | `nicheTools.test.ts` | ✅ |
| Kit inventory carousel | `nicheToolCarousel.module.css` | — | ⚠️ No unit test |
| Pointer marks | `pointerMarks.test.ts` | `pointerMarks.test.ts` | ✅ |
| Air lock snap | `airLockSnap.test.ts` | `airLockSnap.test.ts` | ✅ |
| Resolve studio cursor | `resolveStudioCursor.test.ts` | `resolveStudioCursor.test.ts` | ✅ |
| Dock anchor (reach) | `dockAnchor.test.ts` | `dockAnchor.test.ts` | ✅ |
| Fitts proximity | `fittsProximity.test.ts` | `fittsProximity.test.ts` | ✅ |
| Margin summon | `marginSummon.test.ts` | `marginSummon.test.ts` | ✅ |
| Instrument summon | `instrumentSummon.test.ts` | `instrumentSummon.test.ts` | ✅ |
| Material foley | `materialFoley.test.ts` | `materialFoley.test.ts` | ✅ |
| Ground metrics | `groundMetrics.test.ts` | `groundMetrics.test.ts` | ✅ |
| Tactile ground | `tactileGround.module.css` | `groundMetrics.test.ts` | ✅ |
| Save design canvas | `saveDesignCanvasClient.test.ts` | `saveDesignCanvasClient.test.ts` | ✅ |
| Measure cancel | `measureCancel.test.ts` | `measureCancel.test.ts` | ✅ |
| Describe selected item | `describeSelectedItem.test.ts` | `describeSelectedItem.test.ts` | ✅ |
| Build live measures | `buildLiveMeasures.test.ts` | `buildLiveMeasures.test.ts` | ✅ |

### Feature test coverage summary

| Category | Total features | Has test | No test | Coverage |
|----------|---------------|----------|---------|----------|
| Survey | 10 | 7 | 3 | 70% |
| Sketch | 7 | 5 | 2 | 71% |
| CAD | 11 | 5 | 6 | 45% |
| Quote | 4 | 3 | 1 | 75% |
| Share | 5 | 2 | 3 | 40% |
| Cross-mode | 45 | 28 | 17 | 62% |
| **Total** | **82** | **50** | **32** | **61%** |

---

## 5. USER FLOW AUDIT

### Flow 1: New project creation

```
Landing → /home → address input → confirm-pin → /projects/[id] (survey mode)
```

| Step | E2E test | Tier-1 gaps |
|------|----------|-------------|
| Address autocomplete | E2E `operator-happy-path.spec.ts` | ⚠️ No debounce test, no error state test |
| PIN confirmation | E2E `operator-happy-path.spec.ts` | ⚠️ No timeout test, no retry-limit test |
| Project creation | E2E `operator-happy-path.spec.ts` | ✅ |
| First-paint studio | E2E `canvas-first.spec.ts` | ✅ Now has StudioSkeleton |

### Flow 2: Survey → Sketch → CAD → Quote progression

```
/projects/[id]?mode=survey → sketch → cad → quote
```

| Step | E2E test | Tier-1 gaps |
|------|----------|-------------|
| Mode switch | E2E `design-studio.spec.ts` | ⚠️ No keyboard shortcut test (1/2/3/4) |
| Survey annotations | — | ❌ No E2E for annotation placement |
| Sketch brush | E2E `sketch-surfaces.spec.ts` | ✅ |
| AI ghost scan | E2E `canvas-sketch-ai.spec.ts` | ✅ |
| CAD foundation | E2E `canvas-foundation.spec.ts` | ✅ |
| CAD selection | E2E `interaction-contract.spec.ts` | ✅ |
| Quote generation | E2E `quote-tier1.spec.ts` | ✅ |
| Quote line items | E2E `quote-line-items.spec.ts` | ✅ |

### Flow 3: Client share

```
Studio → Share mode → generate link → client opens /share/[token] → accept/reject
```

| Step | E2E test | Tier-1 gaps |
|------|----------|-------------|
| Share link generation | E2E `share-acceptance.spec.ts` | ✅ |
| Client share twin view | — | ❌ No E2E for client-side viewer |
| Accept flow | E2E `share-acceptance.spec.ts` | ✅ |
| Deposit payment | — | ❌ No E2E for deposit flow |
| Deposit success | — | ❌ No E2E for success page |

### Flow 4: Quote portal

```
Studio → publish quote → client opens /portal/quote/[token] → accept → deposit
```

| Step | E2E test | Tier-1 gaps |
|------|----------|-------------|
| Quote portal render | E2E `quote-tier1-fortune500.spec.ts` | ✅ |
| Quote line items | E2E `quote-line-items.spec.ts` | ✅ |
| Accept quote | E2E `share-acceptance.spec.ts` | ✅ |
| Print quote | — | ❌ No E2E for print CSS (now added) |
| Deposit flow | — | ❌ No E2E |

### Flow 5: Settings management

```
/home → /settings → crew/rate-card/suppliers/etc
```

| Step | E2E test | Tier-1 gaps |
|------|----------|-------------|
| Crew add/remove | — | ❌ No E2E (Dialog now wired) |
| Rate card edit | — | ❌ No E2E |
| Supplier management | — | ❌ No E2E |
| Integration tokens | — | ❌ No E2E (Dialog now wired) |
| License panel | — | ❌ No E2E |

### Flow 6: Phone layout

```
Same routes, data-layout="phone" → bottom sheets, thumb chrome
```

| Step | E2E test | Tier-1 gaps |
|------|----------|-------------|
| Phone layout render | E2E `studio-phone-layout.spec.ts` | ✅ |
| Bottom sheet docks | — | ⚠️ No E2E for new bottom-sheet variants |
| Touch gestures | E2E `canvas-touch-camera.test.ts` | ✅ (unit) |

### Flow 7: Dashboard management

```
/home → filter → sort → search → delete → undo
```

| Step | E2E test | Tier-1 gaps |
|------|----------|-------------|
| Filter by status | — | ❌ No E2E |
| Sort options | — | ❌ No E2E |
| Search | — | ❌ No E2E |
| Delete with Dialog | — | ❌ No E2E (Dialog now wired) |
| Undo from toast | — | ❌ No E2E |

---

## 6. E2E TEST COVERAGE MATRIX

### Screens with E2E coverage

| Screen | E2E specs | Coverage |
|--------|-----------|----------|
| Landing (`/`) | `landing.spec.ts` | ✅ |
| Dashboard (`/home`) | `operator-happy-path.spec.ts` | ⚠️ Partial — no filter/sort/search/delete |
| Studio (`/projects/[id]`) | 20+ specs | ✅ Strong |
| Quote portal | 3 specs | ✅ |
| Share twin | `share-acceptance.spec.ts` | ⚠️ Partial — no client viewer |
| Settings | 0 specs | ❌ None |
| Legal pages | 0 specs | ❌ None (low priority) |
| Sign-in/up | 0 specs | ❌ Clerk-managed (low priority) |
| Confirm PIN | 0 specs | ❌ |
| Deposit flow | 0 specs | ❌ |
| Processing | 0 specs | ❌ |

### E2E spec inventory (40 files)

| Spec | Covers | Status |
|------|--------|--------|
| `canvas-chrome-detector.spec.ts` | Chrome detection | ✅ |
| `canvas-chrome-parenting.spec.ts` | Chrome DOM hierarchy | ✅ |
| `canvas-chrome-screenshots.spec.ts` | Visual regression | ✅ |
| `canvas-compact-chrome.spec.ts` | Compact mode | ✅ |
| `canvas-cream-zoom.spec.ts` | Zoom on cream board | ✅ |
| `canvas-design-craft.spec.ts` | Design tools | ✅ |
| `canvas-first.spec.ts` | First paint | ✅ |
| `canvas-foundation.spec.ts` | CAD foundation | ✅ |
| `canvas-lane-law.spec.ts` | Lane positioning | ✅ |
| `canvas-sketch-ai.spec.ts` | AI ghost scan | ✅ |
| `design-studio.spec.ts` | Mode switching | ✅ |
| `develop-loop.spec.ts` | Develop phase | ✅ |
| `easement-honesty.spec.ts` | Easement display | ✅ |
| `flora-ring-ungate.spec.ts` | Flora ring | ✅ |
| `instrument-dial.spec.ts` | Instrument dial | ✅ |
| `interaction-contract.spec.ts` | Selection interaction | ✅ |
| `landing.spec.ts` | Landing page | ✅ |
| `landscape-services.spec.ts` | Services ledger | ✅ |
| `meeting-pack.spec.ts` | Meeting pack | ✅ |
| `neighbour-lot-skin.spec.ts` | Neighbour lot | ✅ |
| `operator-happy-path.spec.ts` | Project creation | ✅ |
| `pipeline-shell.spec.ts` | Pipeline shell | ✅ |
| `premium-sun-client.spec.ts` | Sun + client view | ✅ |
| `quote-line-items.spec.ts` | Quote lines | ✅ |
| `quote-tier1-fortune500.spec.ts` | Fortune-500 quote | ✅ |
| `quote-tier1.spec.ts` | Quote generation | ✅ |
| `quote-tool-dock.spec.ts` | Quote tool dock | ✅ |
| `render1-presentation.spec.ts` | Render presentation | ✅ |
| `render2-presentation.spec.ts` | Render presentation 2 | ✅ |
| `right-data-lane-keyboard.spec.ts` | Data lane keyboard | ✅ |
| `selection-focus-veil.spec.ts` | Focus veil | ✅ |
| `share-acceptance.spec.ts` | Share accept | ✅ |
| `sheet-presentation.spec.ts` | Sheet presentation | ✅ |
| `site-pack-dig-gate.spec.ts` | Dig gate | ✅ |
| `sketch-image-layers.spec.ts` | Image layers | ✅ |
| `sketch-surfaces.spec.ts` | Sketch surfaces | ✅ |
| `studio-phone-layout.spec.ts` | Phone layout | ✅ |
| `tilt-lens.spec.ts` | Tilt lens | ✅ |
| `vic-gov-status-chips.spec.ts` | Vic-gov chips | ✅ |
| `zone-bom.spec.ts` | Zone + BOM | ✅ |

---

## 7. TIER-1 GAP SCORECARD

### P0 — Must fix for Tier-1

| # | Gap | Impact | Effort |
|---|-----|--------|--------|
| P0-1 | 42 button instances not using shared `Button` | Inconsistent focus rings, hover states, loading indicators | Medium — find/replace per file |
| P0-2 | `--ink-tertiary` fails WCAG AA (3.2:1) | Accessibility violation on muted text | Trivial — bump hex value |
| P0-3 | Type scale tokens defined but unused | No consistent typography rhythm | Medium — migrate all font-size declarations |
| P0-4 | No E2E for settings pages | Settings regressions ship undetected | Medium — 5-8 specs |
| P0-5 | No E2E for deposit flow | Payment regressions ship undetected | Medium — 3 specs |
| P0-6 | No E2E for dashboard filter/sort/search/delete | Dashboard regressions ship undetected | Medium — 2-3 specs |
| P0-7 | `--surface-overlay` identical to `--surface-elevated` | Modals don't visually separate from cards | Trivial — bump hex value |

### P1 — Should fix for Tier-1

| # | Gap | Impact | Effort |
|---|-----|--------|--------|
| P1-1 | `--easement-stroke` too close to `--proposed-stroke` | Plan readability on dense drawings | Trivial — shift hue |
| P1-2 | 32 features with no unit/E2E test | Regression risk | High — 32 tests |
| P1-3 | No unsaved-changes guard on studio | Data loss risk | Medium |
| P1-4 | No keyboard mode-switch shortcuts (1/2/3/4) | Power user friction | Low |
| P1-5 | No breadcrumb trail in project sub-pages | Navigation confusion | Low |
| P1-6 | Portal deposit: no card brand icons, no receipt | Client trust gap | Medium |
| P1-7 | Share twin: no fullscreen toggle, no comment pins | Client review friction | Medium |
| P1-8 | No OG image for landing page | Social sharing looks bare | Low |
| P1-9 | `loading.tsx` uses generic skeleton, not branded | Brand gap on first load | Low |
| P1-10 | No error illustration in `error.tsx` | Brand gap on errors | Low |

### P2 — Nice to have for Tier-1

| # | Gap | Impact | Effort |
|---|-----|--------|--------|
| P2-1 | No bulk-select on dashboard | Productivity | Medium |
| P2-2 | No kanban view for tasks | Productivity | High |
| P2-3 | No CSV export for measurements | Data portability | Low |
| P2-4 | No version diff in develop loop | Audit clarity | High |
| P2-5 | No waveform scrubber for recordings | UX polish | High |
| P2-6 | No calendar invite on deposit success | Client convenience | Low |
| P2-7 | No search in settings | Settings discovery | Medium |
| P2-8 | No drag-to-reorder outputs | Organisation | Medium |

---

## 8. WHAT'S ALREADY WORLD-CLASS

- **Z-index layering** — 15-layer token system, 0 raw numbers, documented stacking order
- **Studio canvas** — 55+ features on one board, disappearing chrome, AI ghosts, Vicmap WFS
- **Compliance engine** — Multi-council profiles, AS 4970 TPZ, permeability, canopy targets
- **Fit sheet** — A3/A4 print-accurate, title boundary, dimensions, presentation widgets
- **Sun & shadow** — 4-layer architecture, date engine, shade grid, climate wash
- **3D system** — CSS 2.5D tilt, Three.js twin, glTF export, AR birdseye
- **Share twin** — Client viewer with 3D, annotations, decision flow
- **Quote portal** — Scenario cards, line items, deposit flow, print CSS
- **Phone layout** — Bottom sheets, thumb chrome, touch camera
- **Colour tokens** — 3-layer architecture, dark grey identity, AA contrast (except `--ink-tertiary`)
- **E2E coverage** — 40 specs covering studio canvas deeply
- **Domain tests** — 47 test files covering all domain logic

---

## 9. RECOMMENDED SEQUENCE

### Phase 1: Accessibility + consistency (P0-1, P0-2, P0-3, P0-7)
1. Fix `--ink-tertiary` contrast
2. Fix `--surface-overlay` distinction
3. Migrate 42 buttons to shared `Button`
4. Migrate font-size declarations to `--text-*` tokens

### Phase 2: Test coverage (P0-4, P0-5, P0-6, P1-2)
5. E2E for settings (crew, rate-card, suppliers)
6. E2E for deposit flow
7. E2E for dashboard (filter, sort, search, delete+undo)
8. Unit tests for 32 untested features

### Phase 3: UX polish (P1-3 through P1-10)
9. Unsaved-changes guard
10. Keyboard shortcuts
11. Breadcrumbs
12. Portal deposit polish
13. Share twin polish
14. OG image + branded loading + error illustration

### Phase 4: Product (P2 items)
15. Bulk select, kanban, CSV export, version diff, waveform, calendar invite, settings search

---

## 10. VERIFICATION COMMANDS

```bash
# Type check
pnpm typecheck

# Lint
pnpm lint

# Unit tests
pnpm vitest run

# E2E tests
pnpm --filter @workstream/web e2e

# Hex colour gate
node scripts/check-handoff-chrome-colors.mjs

# Mobile placeholder gate
node scripts/check-mobile-placeholders.mjs

# CI gate (full)
pnpm run ci
```
