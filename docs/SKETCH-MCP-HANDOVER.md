# Windows MCP handover

Status: repository prepared for a Windows-first MCP workflow without replacing current Workstream logic.

Legacy note: this file path is retained for continuity, but the operating model is now Windows-first and cross-platform. Sketch is optional, not the primary path.

## Goal

Prepare Workstream for MCP-assisted design collaboration on Windows while preserving the current desktop and mobile product logic.

Primary Windows-friendly bridges:

- Figma MCP for design inspection, component comparison, and token/code review
- Stitch MCP for external workflow/data operations where applicable

Optional bridge:

- Sketch MCP only when a separate Sketch-capable host exists

This handover is integration-first, not redesign-destructive:

- Keep the current backend project graph as the source of truth
- Keep the desktop and mobile apps as separate product surfaces
- Let MCP tools inspect, compare, enrich, or import metadata without becoming the application's state owner

## Current repository MCP configuration

Configured repository file:

- [.devin/mcp_config.json](C:/Users/Tim/Downloads/CURTIS-CO/workstream.worktrees/app-review-desktop-mobile/.devin/mcp_config.json)

Relevant MCP entries in the repo today:

- `figma` -> `@modelcontextprotocol/server-figma`
- `stitch` -> `stitch-mcp`
- `sketch` -> `http://localhost:31126/mcp` (kept disabled and optional)

Default repo state:

- `figma.disabled = true`
- `stitch.disabled = true`
- `sketch.disabled = true`

Why disabled by default:

- This repo is shared across environments
- MCP tools should not fail-open when credentials or local services are absent
- Windows operators may choose Figma, Stitch, or neither depending on the current task

## Exact repository config blocks

Use these blocks inside `.devin/mcp_config.json`:

```json
"figma": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-figma"],
  "env": {
    "FIGMA_ACCESS_TOKEN": "${FIGMA_ACCESS_TOKEN}"
  },
  "disabled": true
},
"stitch": {
  "command": "npx",
  "args": ["-y", "stitch-mcp"],
  "env": {
    "STITCH_API_KEY": "${STITCH_API_KEY}"
  },
  "disabled": true
}
```

Optional only:

```json
"sketch": {
  "url": "http://localhost:31126/mcp",
  "type": "http",
  "disabled": true
}
```

## Windows activation checklist

This is the primary activation path for a Windows operator using VS Code, Cursor, or Windsurf.

1. Decide which bridge is needed for the task:
   - Figma for design-source inspection and design-to-code comparison
   - Stitch for the external MCP workflow configured by your team
2. Populate local env values in the Windows workspace:
   - [apps/api/.env.example](C:/Users/Tim/Downloads/CURTIS-CO/workstream.worktrees/app-review-desktop-mobile/apps/api/.env.example)
   - [apps/web/.env.example](C:/Users/Tim/Downloads/CURTIS-CO/workstream.worktrees/app-review-desktop-mobile/apps/web/.env.example)
   - [apps/mobile/.env.example](C:/Users/Tim/Downloads/CURTIS-CO/workstream.worktrees/app-review-desktop-mobile/apps/mobile/.env.example)
3. Set the required secret values in the actual `.env` files or the MCP host environment:
   - `FIGMA_ACCESS_TOKEN`
   - `STITCH_API_KEY`
4. In [.devin/mcp_config.json](C:/Users/Tim/Downloads/CURTIS-CO/workstream.worktrees/app-review-desktop-mobile/.devin/mcp_config.json), set the chosen bridge from `disabled: true` to `disabled: false`
5. Restart the MCP client/runtime
6. Confirm the MCP tools appear and respond before any production-facing sync or import work begins

## Critical preservation rule

Do not treat Figma, Stitch, or Sketch as replacements for Workstream's backend lifecycle.

These tools may feed, inspect, compare, or annotate design artifacts, but these application behaviors must remain owned by Workstream:

- project lifecycle progression
- survey/design/costing/audit/output gating
- quote generation and portal output
- processing and polling status
- mobile capture and API-backed project state

## Desktop surface that must be preserved

Primary desktop entry:

- [page.tsx](C:/Users/Tim/Downloads/CURTIS-CO/workstream.worktrees/app-review-desktop-mobile/apps/web/src/app/projects/[id]/page.tsx)

What this page already does and must keep doing:

- loads the current project via `getProject`
- hydrates the design board from `getDesignCanvas`
- pulls related backend state from survey, outputs, title, design, costings, and audit APIs
- resolves gated mode availability via `resolveCanvasMode`
- resolves pipeline next-step orchestration via `resolveProjectNextAction`
- mounts [HandoffDesignStudio](C:/Users/Tim/Downloads/CURTIS-CO/workstream.worktrees/app-review-desktop-mobile/apps/web/src/components/canvas/handoff/HandoffDesignStudio.tsx) with the full project state

Meaning:

- an MCP link must not bypass this page-level hydration
- imported or synchronized design data must still end up in the same project-backed canvas payload shape that [HandoffDesignStudio](C:/Users/Tim/Downloads/CURTIS-CO/workstream.worktrees/app-review-desktop-mobile/apps/web/src/components/canvas/handoff/HandoffDesignStudio.tsx) already consumes

Processing surface:

- [page.tsx](C:/Users/Tim/Downloads/CURTIS-CO/workstream.worktrees/app-review-desktop-mobile/apps/web/src/app/projects/[id]/processing/page.tsx)
- [ProcessingScreen.tsx](C:/Users/Tim/Downloads/CURTIS-CO/workstream.worktrees/app-review-desktop-mobile/apps/web/src/app/projects/[id]/processing/ProcessingScreen.tsx)

What must be preserved:

- backend progress polling
- retry handling
- redirect into `?mode=sketch` when processing is ready

MCP integration must not replace this pipeline truth with client-only assumptions.

## Mobile surface that must be preserved

Mobile app root:

- [_layout.tsx](C:/Users/Tim/Downloads/CURTIS-CO/workstream.worktrees/app-review-desktop-mobile/apps/mobile/app/_layout.tsx)
- [index.tsx](C:/Users/Tim/Downloads/CURTIS-CO/workstream.worktrees/app-review-desktop-mobile/apps/mobile/app/index.tsx)
- [WebPreviewHome.tsx](C:/Users/Tim/Downloads/CURTIS-CO/workstream.worktrees/app-review-desktop-mobile/apps/mobile/src/components/WebPreviewHome.tsx)

Primary mobile studio route:

- [design-studio/[id].tsx](C:/Users/Tim/Downloads/CURTIS-CO/workstream.worktrees/app-review-desktop-mobile/apps/mobile/app/(app)/design-studio/[id].tsx)

Desktop handoff affordance:

- [MobileSketchTopbar.tsx](C:/Users/Tim/Downloads/CURTIS-CO/workstream.worktrees/app-review-desktop-mobile/apps/mobile/src/components/sketch/MobileSketchTopbar.tsx)

What must be preserved:

- mobile remains its own Expo app, not a responsive branch of the web app
- mobile uses API-backed state through `useWorkstreamApi`
- mobile's "Open in Studio" bridge remains the handoff into the desktop surface

Meaning:

- MCP integration must not collapse desktop and mobile into one UI path
- any MCP-driven workflow must still support the current mobile-to-desktop bridge

## Shared logic that must remain the source of truth

Contracts and domain:

- [packages/contracts/](C:/Users/Tim/Downloads/CURTIS-CO/workstream.worktrees/app-review-desktop-mobile/packages/contracts)
- [packages/domain/](C:/Users/Tim/Downloads/CURTIS-CO/workstream.worktrees/app-review-desktop-mobile/packages/domain)

Shared design system:

- [tokens.ts](C:/Users/Tim/Downloads/CURTIS-CO/workstream.worktrees/app-review-desktop-mobile/packages/ui/src/tokens.ts)

Integration rule:

- if an MCP bridge introduces new imported shapes, metadata, or asset mappings, evolve the contracts first
- then align the API
- then align the desktop/mobile consumers

Do not let tool-specific payloads leak directly into only one surface.

## Design-to-contract field mapping

Design metadata must be mapped into Workstream contracts deliberately rather than passed through raw.

| Design source | Workstream target | Rule |
| --- | --- | --- |
| Layer or component name | canonical object label / display name | Preserve human-readable naming, but normalize before persistence |
| Symbol or component identifier | stable catalog or component reference | Store as imported metadata, never as the sole business identifier |
| Frame, group, or variant hierarchy | presentation grouping metadata | May inform UI grouping, but not lifecycle gating |
| Position and bounds | canvas geometry fields | Must be converted into the project coordinate system before save |
| Fill, stroke, or style token | semantic material or visual token mapping | Map through approved semantic tokens, not raw design color as business truth |
| Notes, descriptions, annotations | object metadata / commentary | Append-only unless explicitly user-approved |
| Exported asset reference | attachment or preview artifact | Treated as derivative output, not source-of-truth geometry |

Contract-first rule:

- if new metadata is useful, evolve [packages/contracts/](C:/Users/Tim/Downloads/CURTIS-CO/workstream.worktrees/app-review-desktop-mobile/packages/contracts) first
- then align API ingestion
- then align desktop and mobile consumers

## Post-sync validation checklist

After the first live Windows-side sync, validate both product surfaces.

### Desktop checks

- [page.tsx](C:/Users/Tim/Downloads/CURTIS-CO/workstream.worktrees/app-review-desktop-mobile/apps/web/src/app/projects/[id]/page.tsx) still hydrates the project, canvas, survey, outputs, costings, and audit state
- [HandoffDesignStudio](C:/Users/Tim/Downloads/CURTIS-CO/workstream.worktrees/app-review-desktop-mobile/apps/web/src/components/canvas/handoff/HandoffDesignStudio.tsx) renders imported data without bypassing existing mode gating
- `resolveCanvasMode` still clamps locked modes correctly
- quote and output state remain derived from Workstream state, not tool-only state
- coordinate alignment is correct against title boundary, building, and board scale

### Mobile checks

- [design-studio/[id].tsx](C:/Users/Tim/Downloads/CURTIS-CO/workstream.worktrees/app-review-desktop-mobile/apps/mobile/app/(app)/design-studio/[id].tsx) still opens the correct project-backed mobile design surface
- [MobileSketchTopbar.tsx](C:/Users/Tim/Downloads/CURTIS-CO/workstream.worktrees/app-review-desktop-mobile/apps/mobile/src/components/sketch/MobileSketchTopbar.tsx) still bridges correctly into desktop studio
- API-backed reads through `useWorkstreamApi` still return the same canonical project state after sync
- mobile preview and on-site capture do not drift from desktop geometry after import

## Do-not-overwrite import policy

MCP tools may enrich the project, but they must not overwrite site truth owned by the Workstream backend unless there is an explicit, audited user action.

Protected fields and structures include:

- surveyed boundary geometry
- easements and services facts
- site origin and calibration anchors
- backend-owned lifecycle status
- survey, costing, audit, and output truth

Default governance:

- MCP tools can append creative metadata
- MCP tools can contribute presentational structure
- MCP tools can propose or import design-layer geometry
- MCP tools cannot silently replace protected backend facts

## Collision and safety policy

If an imported object conflicts with surveyed or backend-owned safety-critical site data, safety wins.

Default strategy:

- mark the imported object as `CONFLICT`
- preserve the surveyed utility, easement, or protected site fact
- require explicit human review before the conflicting object can be promoted downstream

This rule is especially important where design intent intersects with:

- subsurface utilities
- access corridors
- easements
- title constraints
- protected site boundaries

## Recommended Windows-first MCP operating model

Use Figma MCP for:

1. inspecting design documents, components, and layout metadata
2. comparing implemented UI against the design source
3. reviewing variable and token alignment
4. assisting design-to-code auditing

Use Stitch MCP for:

1. external MCP workflows your team has configured around Stitch
2. orchestrated data pulls or transformations that support the app workflow
3. enrichment tasks that should not replace Workstream project truth

Do not use MCP as:

- the primary storage layer for project state
- a replacement for the project canvas API
- a replacement for Workstream's survey/design/costing/audit pipeline

## Optional Sketch note

Sketch may still be used later, but it is not the primary Windows path.

If a real Sketch-capable host exists, keep the `sketch` entry disabled by default until that host is available and validated. Do not block Windows workflow on Sketch MCP.

## Current cleanup included in this prep

- rewrote this handover as a Windows-first MCP guide
- kept desktop and mobile preservation boundaries explicit
- retained `sketch` as optional only
- kept `figma` and `stitch` available as the primary cross-platform bridges
- scrubbed a mistakenly populated `STITCH_API_KEY` from [apps/api/.env.example](C:/Users/Tim/Downloads/CURTIS-CO/workstream.worktrees/app-review-desktop-mobile/apps/api/.env.example)
- added `FIGMA_ACCESS_TOKEN` placeholders to:
  - [apps/api/.env.example](C:/Users/Tim/Downloads/CURTIS-CO/workstream.worktrees/app-review-desktop-mobile/apps/api/.env.example)
  - [apps/web/.env.example](C:/Users/Tim/Downloads/CURTIS-CO/workstream.worktrees/app-review-desktop-mobile/apps/web/.env.example)
  - [apps/mobile/.env.example](C:/Users/Tim/Downloads/CURTIS-CO/workstream.worktrees/app-review-desktop-mobile/apps/mobile/.env.example)
