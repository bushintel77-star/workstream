# Mobile project home — site cockpit

**Status:** Implemented per UI review (May 2026)  
**Code:** `apps/mobile/src/components/site/*`, `apps/mobile/app/(app)/project/[id].tsx`  
**Tokens:** `packages/ui/src/tokens.ts` (no parallel mobile palette)  
**Copy:** `packages/domain/src/site-garden-copy.ts`

## Role

The project home is a **console**: one pipeline next step in the fixed bottom chrome. A **status panel** above it (three tiles + utility links), not a navigation grid.

## Layout (top → bottom)

1. **Title hero** — mapped backyard SVG when survey exists.
2. **Hero meta strip** — today’s weather glyph + season/sun/planning chips, pinned `108px` above the title band (not `%` of hero height).
3. **Site status** — `Right job?` (wide), `Outstanding`, `Money story`.
4. **Utility row** — sketch, filing, reach client (tertiary, not equal tiles).
5. **Scroll** — survey ledger, pipeline sections, transcript, etc.
6. **Bottom chrome** (fixed) — compact voice row (yarn | note), then **What’s next** CTA (`tokens.color.accent`).

## Accessibility

- Folksy on-screen labels stay in `GARDEN_COPY.widgets`.
- Plain-language `GARDEN_COPY.widgetHints` on every interactive control.
- Minimum type: `tokens.type.micro` (11px) in meta strip and widgets.

## Animation

- `WeatherGlyph` motion pauses when the project screen loses focus (`useFocusEffect`).
- Respects reduce-motion via `AccessibilityInfo.isReduceMotionEnabled()`.

## Out of scope here

- 5-day forecast bottom sheet (today-only on hero; full forecast can move to studio).
- Salmon / parallel `site-palette` fork — retired in favour of shared tokens.

See also: [UI-FOCUS.md](./UI-FOCUS.md), [site-garden-copy.ts](../packages/domain/src/site-garden-copy.ts).
