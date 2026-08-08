# Architecting the 2026 landscape co-pilot: Tier-1 frontend design specification

**Status:** Workflow 1 binding (hybrid reconcile)  
**Date:** 2026-08-09  
**Companion inventory:** [`../DESIGNER-FEATURE-INVENTORY.md`](../DESIGNER-FEATURE-INVENTORY.md)  
**Gap checklist:** [`TIER1-2026-SPEC-GAP-CHECKLIST.md`](./TIER1-2026-SPEC-GAP-CHECKLIST.md)

## Non-goals (locked)

These clauses from the source prose are **aspirational Stage 2** and must not drive Workflow 1 implementation:

- React Three Fiber / WebGL as the **primary** drafting engine
- Zustand (or any new global state library) for studio state
- Restoring deleted web `/settings/*` UI
- Live BYDA underground APIs (typed strokes + honesty only)
- Survey-grade CAD / DXF paper space

**Canonical product surface:** `HandoffDesignStudio` at `/projects/[id]?mode=…` — `%-coord` parchment board + `CameraChrome` portals. Dual-canvas R3F remains only where already shipped (share twin / AR / tilt).

---

## Executive overview

The 2026 spatial UI paradigm treats the digital drawing as the singular product. Chrome retreats to the periphery as an ambient co-pilot. AI is woven into spatial workflows under a non-destructive **ghost until Accept** protocol. Semantic CSS tokens replace hard-coded hex. Identity: dark grey gallery frame + cream plan board + frost docks — not blush chrome, purple glow, or default Inter/Roboto.

## Foundational architecture and routing

Legacy project sub-pages (`/overview`, `/tasks`, `/design/cad`, …) redirect into one design surface. Mode is a URL search param on `/projects/[id]`. Geometry stays in memory across mode switches; React overlays swap contextually.

| Category | Routes | Responsibility |
|----------|--------|----------------|
| Public | `/`, `/legal/privacy`, `/legal/terms` | Brand hero, CTA, legal |
| Auth | `/sign-in`, `/sign-up` | Clerk |
| Operator hub | `/home`, `/confirm-pin`, `/projects/[id]/processing` | Address, grid, pin, pipeline wait |
| Design studio | `/projects/[id]?mode=…` | Infinite canvas; Survey / Sketch / CAD / Elevation / Quote / Present / Share |
| Client portals | `/portal/quote/[token]`, `/portal/deposit/[token]`, `/share/[token]` | Quote sheet, Stripe deposit, share twin |
| Deprecated | `/settings/*` | 404 — do not design unless product restores |

## Canvas-first chrome

- Idle recession ~6s — rails dim; no fixed opaque bars on the plan
- Inventory summoned at margin only when placing
- Frost UI **outside** zoom/rotate camera (`CameraChrome` → `camera-chrome-root`)
- Pan = Space/middle-drag gesture only — never a dock tool
- **Dual dialects:** flat IDE frame bands vs liquid-glass floating docks — never mixed

## Semantic colour tokens

Forbidden: hard-coded hex/RGB in chrome modules (CI: `web:check-handoff-colors`).

| Category | Tokens |
|----------|--------|
| Shell | `--surface-base\|elevated\|sunken\|overlay\|panel\|deep` |
| Ink | `--ink-primary\|secondary\|tertiary\|inverted` |
| Accent / semantic | `--accent*`, `--ok`, `--warn`, `--block`, `--info`, `--signal` |
| Plan ink | `--existing-stroke`, `--proposed-stroke`, `--planting-*-stroke`, `--easement-stroke` |
| Chrome / portal | `--ws-frame-*`, `--hc-glass*`, `--hc-neu-*`, `--sheet-*`, `--portal-*` |

Typography: IBM Plex (Mono/Sans/Serif); plan annotations use Architects Daughter. Scale `--text-femto`…`--text-3xl`. Radii `--r-sm`…`--r-pill`. Sentence case; en-AU; AUD/GST.

Frost docks: `backdrop-filter` **plus** min opacity background, hairline border, soft elevation so composited AA holds (`e2e/canvas-contrast-aa.spec.ts`).

## AI to the core

Commands via Cmd+K / selection orbits / capability cues. All generative geometry is ephemeral ghost until explicit Accept. Reject or mode-change clears ghosts — no silent-write into persistent CAD.

Palette groups: AI · Site · BYDA · Design · View · Place (see designer inventory).

## Seven studio lenses

| Mode | Job | Hero elements |
|------|-----|---------------|
| Survey | Site facts | Checklist 5/5, Trace/Calib/Level/Servc, Vicmap, keyless washes |
| Sketch | Intent | Sketch dock, tidy/convert, Flora ring (partial) |
| CAD | Geometry | Add/Paint/Zone, assets, orbit/dial, ghosts, trenches, TPZ/NRZ |
| Elevation | Section | Elevation board, callouts, thumbs |
| Quote | Indicative $ | Quote builder, live cost; services locked |
| Present | Meeting deck | Pages, swatches, format ghosts |
| Share | Client handoff | Portal URL, revision + liability gate |

**Lock copy (exact):**

- Sketch / CAD / Elevation: `Complete survey and title boundary first.`
- Quote: `Accept CAD geometry before quoting.`
- Share: `Cost something on the drawing before sharing.`

Global instruments: Fit sheet (**F**), tilt, services ledger, layers, live measures, client presentation.

## Board honesty

Aerial under title boundary. Easement hatch + honesty (title ≠ BYDA assets). Persistent line: *Concept sketch for estimating — not a construction drawing.*

## Mapping and AS 4970-2025

Vicmap Property Simplified for Victorian parcels; surface Horizontal Positional Uncertainty (HPU) when present — never invent it.

Tree protection (domain module `as4970-protection-zones`):

- NRZ = clamp(DBH × 12, 2 m, 15 m) (legacy label TPZ)
- Multi-stem combined DBH = √(Σ Di²)
- SRZ = (D × 50)^0.42 × 0.64, min 1.5 m
- Encroachment tiers: none (&lt;0.05% NRZ) / minor (≤10%, outside SRZ) / moderate (11–20%, outside SRZ) / major (&gt;20% NRZ or any SRZ intrusion)

## Client portals

Dark operator studio vs light printable portal sheet tokens. Quote → deposit (Stripe) → success/cancel. Share twin chrome-off; revision 404.

## Designer deliverable packs

Gallery frame idle/active · summoned docks kit · tool/sketch docks · board ink legend · Fit sheet A3/A4 · Quote/Share/Present · portal quote+deposit · empty/locked/ghost/error states.

## Code anchors

`apps/web/src/components/canvas/handoff/` · `styles/globals.css` · `styles/color-tokens.css` · `handoffStudio.module.css` · `packages/domain/src/as4970-protection-zones.ts` · `apps/api/src/lib/vicmap.ts`
