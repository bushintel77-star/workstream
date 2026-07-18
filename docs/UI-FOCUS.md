# Workstream UI focus

Single track: **operator clarity** + **client confidence**. Everything else waits.

## Two surfaces

| Surface | User | Job |
|---------|------|-----|
| **Studio** (operator web) | Tim / Morgan | One site canvas → live BOM → share |
| **Portal** (token links) | Homeowner | Understand design, compare price, pay deposit |

Brand: **Curtis & Co** on portal — **Workstream** on the operator home shell.

**Design System 3.0** — soft-pink editorial field `#D4849A`, cool blush
surfaces, type **Fraunces** + **Sora**.

**One canvas:** `/projects/:id` is the only operator surface. Modes via
`?mode=` are **lenses** (Survey · Sketch · CAD · Quote · Share) into one world —
not an estimation pipeline. **Material Orchestrator** keeps a live preemptive BOM
and risk overlays on Sketch/CAD/Quote. Progressive disclosure: only the current
lens + next unlock show.

**2-minute first run:** address → confirm aerial → `?guide=1` → one tap
**Prepare this site** (starter massing + AI CAD when available) → nudge → share.
Legacy routes redirect into the canvas. Client portal + Settings stay separate.

## Studio — status

| Priority | Item | Status |
|----------|------|--------|
| P0 | Operator nav (Projects, Settings) | Shipped — unified `AppNav` in layouts |
| P0 | One-canvas lenses + progressive disclosure | Shipped |
| P0 | Live BOM + preemptive materials / risk overlays | Shipped — orchestration API + HUD |
| P1 | Site walk checklist on project hub | Shipped |
| P1 | Outputs card grid + client handoff | Shipped — `outputs/page.tsx` + `ProjectClientHandoff` |
| P1 | AI CAD Stage 2 (LibreCAD DXF + ghosts) | Shipped — canvas CAD lens + `@workstream/cad` |

## Portal — status

| Priority | Item | Status |
|----------|------|--------|
| P0 | Dedicated portal layout (no studio chrome) | Shipped |
| P0 | Lean / Standard / Buffer scenario picker | Shipped |
