# AI detection — proposal only (Phase 6 deferred)

**Status:** Not implemented. No detection libraries added.

## Goal

On aerial load, suggest (never auto-save) ghost overlays for building footprint, tree canopies, and paving. User confirms before symbols enter `DesignCanvas`.

## Recommended approach

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Input | Existing `survey.aerial_uri` static image | No Mapbox GL; bounds from `mapView.ts` |
| Detection | **Server-side** batch on API after survey | Keeps mobile/web thin; uses existing `ANTHROPIC_API_KEY` |
| Model | Claude vision (already in stack) or SAM-style OSS on Fly worker | Vision = fast to ship; SAM = cost/complexity |
| Output | Ephemeral `GhostPlacement[]` in client state only | Never in `UpsertDesignCanvas` until user taps Confirm |
| UX | 40–55% opacity ghosts + hover “why” line | Distinct from placed symbols (ink, full opacity) |

## API shape (future)

```
POST /projects/:id/design/ghosts
→ { suggestions: [{ symbol_id, x_pct, y_pct, confidence, reason }] }
```

Client renders suggestions; Save ignores them unless promoted to `CatalogPlacement`.

## Cost / risk

- **Cost:** ~1 vision call per survey (~$0.02–0.08 at current Claude pricing) — gate behind Settings toggle.
- **Risk:** Over-trust — mitigated by honesty UI (Phase 7) and mandatory confirm.
- **STOP:** Do not add `tensorflow`, `opencv4nodejs`, or Mapbox GL without a new brief.

## Prerequisites before build

1. Phase 5 scale bar + modeless canvas shipped.
2. Product sign-off on vision vs OSS detector.
3. `SENTRY_DSN` + job metrics to observe failure rates.

## Out of scope

- Envelope estimate changes.
- Auto-saving detected geometry.
- 3D / photoreal outputs.
