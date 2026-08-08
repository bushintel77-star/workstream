# Tier-1 gap analysis — refresh (2026-07-27)

> **⚠️ HISTORICAL DOCUMENT — superseded 2026-08-02.**
> Live source of truth: [`docs/MASTER-GAP-ANALYSIS-2026-08-02.md`](../../../MASTER-GAP-ANALYSIS-2026-08-02.md)
> Scores here are stale; the canvas-first studio, Vicmap WFS, and unified
> token system shipped after this audit.

**Author:** Claude (chief design + architect)
**Supersedes for scoring:** [TIER1-AI-CANVAS-GAP-AUDIT.md](./TIER1-AI-CANVAS-GAP-AUDIT.md) (2026-07-19)
**Surface:** live `HandoffDesignStudio` (`%`-coord aerial board), tree `main @ a6565f2`
**Method:** re-grounded against the *current* `features/*` tree this session; scores are code-read judgement, not exhaustive QA. Items I could not execute (vitest — pnpm symlink store doesn't resolve in the authoring sandbox) or could not re-run live (Vicmap) are marked **relayed/unverified**.

---

## 0. Read this first — the prior audit is stale

The 2026-07-19 audit and `IMPLEMENTATION-STATUS.md` are **out of date against the current code** and should not be trusted as-is for scoring:

- They reference **removed MapLibre** surfaces (`SiteCanvas`, `GeoSiteMap`, "MapLibre survey pipeline", "MapLibre layer") as evidence, which the audit's own §2 says were deleted.
- They use **pre-rename component names** (`LiveBomHud`, `CanvasToolRail`, `SketchInstrument`, `CadEntityHandles`, `ArchitecturalSheet`) that no longer exist; the tree is now decomposed under `features/*` (`LiveBomDock`, `CadPlanBoard`, `AssetPanel`, `FitSheetOverlay`, `VicGovStatusChipRow`, …).
- Work landed since (card→chip row `685fcde`, dwelling-area sanitize `996273e`/`df3d2c8`, quote presentation surface, unified rail/library/path grammar) isn't reflected.

**First recommendation (process):** treat the two prior docs as historical, and keep this refresh + `ARCHITECTURE.md` as the live source of truth. Dual-truth docs are how "Done" claims drift from the live mount — the audit warned about exactly this (rule §6).

---

## 1. What "Tier-1" means here (unchanged, still correct)

The gold standard is **not** Vectorworks/Land F/X parity. It is the intersection the prior audit defined and it still holds: canvas-first (drawing plane is the product), AI-first HITL (ghosts + binary confirm, never silent mutation), material orchestration (one live estimate), preemptive compliance, AU residential honesty (indicative, GST, AS 4970, council), and the Tier-1 Wrights Terrace business loop (value ledger → quote → share/portal). Product stance to **not** relitigate: stay indicative + honest for Workflow 1; Stage 2 (metre/DXF/grading) stays firewalled.

**One addition to the bar, per operator direction (2026-07-27):** Tier-1 now explicitly means **desktop *and* mobile capable — not limited on either**. That makes responsive parity a scored pillar, not an afterthought.

---

## 2. Refreshed scorecard (current tree)

```text
Canvas-first / chrome   ████████░░ 4.3  ↑  (meta cards → Vic-gov chip row shipped)
AI-first HITL           ████████░░ 4.0  =
Material / cost engine  ████████░░ 3.9  ↑  (trade sourcing, isolith, flora)
Quote builder / biz loop ██████░░░░ 3.0  •  presentation-only; not editable (NEW breakout)
Compliance foresight    ████████░░ 3.8  =
Drafting (Workflow 1)   ███████░░░ 3.6  =
Site intelligence       ██████░░░░ 3.2  ↑  (shade grid, easements, urban trees, dwelling hydrate)
Persistence / share     ███████░░░ 3.5  ↑  (canvasBridge + saveDesignCanvas + ShareRevision)
Paper / Fit sheet       ███████░░░ 3.7  =
Responsive / mobile     ████░░░░░░ 2.0  •  NEW pillar — thin; desktop-oriented
Immersive walk / clay   ██░░░░░░░░ 1.0  =  (deferred)
Stage 2 CAD             ███░░░░░░░ 1.5  =  (intentionally deferred)
```

`↑` improved since 2026-07-19 · `=` unchanged · `•` new/broken-out this refresh.

---

## 3. The three highest-leverage gaps (current)

### G1 — Quote is presentation-only, not an editable builder  · **P0 for the business loop**

Evidence: `features/tier1/quotePresentationModel.ts` has no qty/rate/margin/override/add/remove; `FitSheetOverlay` is a read-only plot sheet; `LiveBomDock.onOpenQuote` opens a presentation, not an editor. The estimate **engine** is strong (`StudioEstimateReport`, `buildSketchLineItems`, `resolveSiteAreaDisplay`, trade sourcing) and `ShareRevision.quoteLines` already freezes a client snapshot — but there is **no operator editing layer** between them (line qty/rate/notes, custom lines, sections, margin/markup, alternates, exclusions).

Why it's tier-1 critical: Curtis & Co's loop ends at a **quotation**. Without light editing, every real-world price adjustment forces a spreadsheet outside the product, breaking the "one estimate" rule and the tier-1 value narrative.

Move: build the editable **QuoteDoc overlay** on top of the engine (spec already handed over — see `docs/design-returns/2026-07-27-canvas-asset-menu-and-quote-builder.md`). Overlay, never mutate the engine; re-merge overrides by SKU on re-estimate.

### G2 — Mobile / responsive parity is thin  · **P0 per operator direction**

Evidence: ~32 `@media` blocks across ~60 `features/*` dirs; the matches that exist are incidental (`viewNorthControl` 900px, `fitSheet` 96px). No mobile bottom-sheet asset browser, no coarse-pointer placement path, no responsive quote/fit layout. The studio is effectively desktop-first.

Why tier-1: the operator explicitly wants "computer and mobile capable, not limited on either." A landscape designer on-site (phone/tablet) is a core Tier-1 use case (survey checklist, place, quote in front of the client).

Move: bake 375/720/960 into the two active workstreams first (asset command-sheet + responsive quote), then sweep the remaining docks (compliance, layers, live BOM) for bottom-sheet/coarse-pointer variants. Add a responsive acceptance gate to the gold rules (§5).

### G3 — Asset menu still leans on persistent chrome  · **P1**

Evidence: `AssetPanel` is a good collapsible dock, and the oversized meta cards are already gone (chip row, `685fcde`) — but placement is dock-led, not command-led, and there's no mobile sheet. Canvas-first wants placement to be **command-first** (type-to-place), dock as secondary browse, and a thumb-reachable mobile equivalent.

Move: promote `StudioCommandPalette` to the primary placement path; default the dock to a slim auto-collapsing rail; add `AssetCommandSheet` for mobile (spec handed over).

---

## 4. Other confirmed gaps (this session)

| ID | Gap | Pillar | Evidence | Priority |
| --- | --- | --- | --- | --- |
| G4 | Dwelling outline uses **largest-intersecting** footprint with no containment/overlap filter | Site intel accuracy | `vicmap.ts fetchBuildingPolygon` → `largestPolygonRing`; no clip to title | P1 (dense terraces: Prahran/Stonnington) |
| G5 | Coverage guard (`0.8`) sanitizes the **area figure** but not the rendered **geometry** | Compliance/site intel | `siteScheduleDisplay.ts` guards area; outline unguarded | P1 (pairs with G4) |
| G6 | Multi-council compliance profiles | Compliance | Stonnington constants only (audit P3.3) | P2 |
| G7 | Vision canopy still heuristic | AI depth | colour-cluster fallback (audit P2.1) | P2 |
| G8 | Utilities / DBYD honesty overlay depth | Site intel | easements hatched; utilities manual | P2 |
| G9 | Export pack (PDF/print) vs browser print | Paper | audit P (partial) | P2 |
| G10 | Doc dual-truth (stale audit/status, MapLibre refs) | Process | §0 above | P1 (cheap, high-clarity) |

**Verified-correct this session (not gaps):** the dwelling "outline unavailable" cue is honest for 12 Wrights Terrace (Vicmap returns 0 intersecting footprints; cue keys off `building.length < 3`; no invented box). The area coverage guard is well tested (185-vs-3013, ≤80%/≤100% clamps). *Live Vicmap 0-feature result relayed from Cursor, not re-run here.*

---

## 5. Gold-standard acceptance rules (carried forward + 1 new)

Keep the prior audit's PR gates (state-machine chrome; invisible engine; binary AI; one estimate; honesty copy; no dual truth; Stage 2 firewall). **Add:**

8. **Responsive parity** — every new studio surface ships a 375 and 960 layout (bottom-sheet/coarse-pointer where docks don't fit); no desktop-only dock without a mobile peer or an explicit deferral note.

---

## 6. Recommended sequence (smallest high-leverage first)

1. **G1 + G3** via the handed-over spec — editable quote builder + command-first/mobile asset menu (covers two P0s and a P1, and the two features the operator asked for).
2. **G2** responsive gate applied to those PRs, then swept across remaining docks.
3. **G10** retire/annotate the stale audit + status docs (point to this refresh + `ARCHITECTURE.md`).
4. **G4/G5** add a containment/overlap-ratio filter to `fetchBuildingPolygon` (prefer the footprint mostly inside the title ring) — low effort, real accuracy win for terraces.
5. Then **G6–G9** as capacity allows. Stage 2 stays firewalled.

---

## 7. Honesty notes (verify-before-trust)

- Scores are code-read judgement from this session, not full QA; treat ±0.3 as noise.
- Prior "Done" claims were **not** re-verified line-by-line; where I re-grounded (quote editability, mobile density, dwelling path) I cite current-tree evidence.
- Vitest and live Vicmap could not be executed in the authoring environment; run `pnpm --filter @workstream/web test` / `@workstream/api test` and a live Vicmap probe before treating G1/G4 remediation as complete.
