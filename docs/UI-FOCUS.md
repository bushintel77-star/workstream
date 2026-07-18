# Workstream UI focus

Single track: **operator clarity** + **client confidence**. Everything else waits.

## Two surfaces

| Surface | User | Job |
|---------|------|-----|
| **Studio** (operator web) | Tim / Morgan | One site canvas → quote → share |
| **Portal** (token links) | Homeowner | Understand design, compare price, pay deposit |

Brand: **Curtis & Co** on portal — **Workstream** on the operator home shell.

**Design System 3.0** — soft-pink editorial field `#D4849A`, cool blush
surfaces, type **Fraunces** + **Sora**.

**One canvas:** `/projects/:id` is the only operator surface. Modes via
`?mode=` — Survey · Sketch · CAD · Quote · Share. Legacy pipeline routes
redirect into the canvas. No pipeline tab masthead. Client portal + Settings
stay separate.

## Studio — status

| Priority | Item | Status |
|----------|------|--------|
| P0 | Operator nav (Projects, Settings) | Shipped — unified `AppNav` in layouts |
| P0 | Pipeline rail — one obvious next step | Shipped — inline on project hub + locked stages |
| P0 | Costing scenario cards (match portal) | Shipped — inline on `costing/page.tsx` |
| P1 | Site walk checklist on project hub | Shipped |
| P1 | Outputs card grid + client handoff | Shipped — `outputs/page.tsx` + `ProjectClientHandoff` |
| P2 | Design page zone cards + Tier-1 styling | Shipped — `DesignProposalView` |
| P1 | AI CAD Stage 2 (LibreCAD DXF + ghosts) | Shipped — `/design/cad` + `@workstream/cad` |

## Portal — status

| Priority | Item | Status |
|----------|------|--------|
| P0 | Dedicated portal layout (no studio chrome) | Shipped |
| P0 | Lean / Standard / Buffer scenario picker | Shipped |
| P1 | Hero + savings ledger for Tier-1 addresses | Shipped |
| P2 | Dusk/lighting visual chapter (image slot) | Backlog |

## Mobile

| Priority | Item | Status |
|----------|------|--------|
| P0 | Match studio tokens from `@workstream/ui` | Shipped (site cockpit) |
| P1 | Single next-step CTA on project screen | Shipped (`ProjectBottomChrome`) |
| P1 | Site status panel (3 tiles, not 8) | Shipped — see `docs/MOBILE-SITE-COCKPIT.md` |
| P2 | TestFlight distribution | Backlog |

## Out of scope (distractions)

- Excel workbook import
- Fly app rename
- KellyBet / broker777
- New backend features without a UI surface
