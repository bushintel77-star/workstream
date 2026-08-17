# Workstream — Design Principles 2026

**Date:** 2026-08-17 · **Status:** Canonical reference — the binding UX law for
every screen and feature. Sources of authority: `GOLD-STANDARD-2026.md`
(architectural brief — "the drawing is the product"),
`GOLD-STANDARD-2026-ARCHITECTURE.md` (WebGL scene-graph + chrome layering),
`DESIGN-DNA.md` (shared visual language — site-plan grammar).

Companion docs: `PRODUCTION-ROADMAP-2026-08-17.md` (phases + rails) ·
`FEATURE-LIST-CONCEPT-TO-SIGNOFF.md` (workflow feature inventory).

---

## Positioning

**2026 landscape-design UX, gold-standard drafting logic — AI-native,
canvas-first.** Workstream is the drawing surface of a landscape architecture
practice, not a SaaS dashboard. Every feature, every screen, every readout is
checked against the three pillars below.

## Pillar A — AI-native

AI is not a feature you open; it is woven into the drafting act, **on the
canvas**. Ghosts, snaps, auto-placement, tidy-up, live estimation, compliance
foresight — all live in the drawing, not in a chatbot panel.

Rules:
- AI output enters the canvas as a **provisional ghost**; the operator always
  holds the pen and accepts/rejects in one on-canvas gesture.
- AI is invoked from the drafting act (gesture, Cmd+K, contextual cue) — never
  from a separate AI sidecar.
- Every AI suggestion is **traceable to ground truth or labelled indicative**
  (ground-truth rule — see `PRODUCTION-ROADMAP-2026-08-17.md` §1).
- AI keeps freehand tidy but never silently replaces operator geometry.

## Pillar B — Canvas-first

**The drawing is the product.** The canvas is the primary surface; all chrome
floats above it as frosted Paper Cards that retract when idle. No sidebars, no
modal forms for core drafting, no permanent panels.

Rules:
- Every drafting action happens on-canvas — placing an asset never opens a dialog.
- Readouts (live BOM, measures, compliance, sun) are **canvas-anchored Paper
  Cards**, not side panels.
- Zero permanent chrome: idle recession, floating HUD, full-bleed WebGL
  (`inset-0`, `alpha: false`, clears to Studio Paper `#F4F4F4`).
- 60fps law: spatial interaction mutates refs; React state syncs on completion
  (perf-isolation — `PRODUCTION-ROADMAP-2026-08-17.md` Phase 1).

## Pillar C — Gold-standard drafting logic

Workstream speaks the drafting grammar of a landscape architecture practice:
boundary lines, setback dimensions, contours, north arrow, scale bar, title
block, hatching — not generic SaaS UI.

Rules:
- Drawing vocabulary is the site-plan grammar (`DESIGN-DNA.md`): dimension-line
  dividers, title blocks, index numbers, status dots, hairline rules.
- **Metre-space, origin-locked** — `(0,0,0)` is the survey peg; 1 unit = 1 metre.
- **Southern-Hemisphere correctness is non-negotiable** — sun/shadow, season,
  north orientation.
- Honesty: every metre readout is ground truth or explicitly *indicative*.

---

## Conformance check (audit)

Each screen is audited against the three pillars. A feature that needs a modal
or sidebar for a core action, or an AI action that isn't ghosted, or a readout
that can't be traced — is logged as **design debt** and fixed before the screen
is marked done.

| Pillar | Fail signal | Fix |
| ------ | ----------- | --- |
| A — AI-native | AI action lives outside the canvas / isn't a ghost | Move onto canvas, ghost + one-gesture accept |
| B — Canvas-first | Core action opens a modal/sidebar; readout is a side panel | Re-anchor to canvas as a floating Paper Card |
| C — Drafting logic | Generic SaaS UI; readout not traceable | Apply site-plan grammar; label indicative or trace it |
