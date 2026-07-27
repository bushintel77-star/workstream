# Quote workflow — envelope sketch first

## Intended operator sequence (back-of-envelope)

```mermaid
flowchart LR
  A[Survey / aerial] --> B[Envelope sketch]
  B --> C[Envelope estimate]
  C --> D[Planning flags TRP council]
  D --> E[AI design from sketch]
  E --> F[Full costing]
  F --> G[Audit]
  G --> H[Quote + permits]
```

| Step | Operator | System |
|------|----------|--------|
| 1 | Confirm site | Survey — aerial, m² |
| 2 | **Envelope sketch** | Drag trees, lawn, paving; mark **TRP zone** / **existing tree** if needed |
| 3 | **Envelope estimate** | Budget band (e.g. $180k–$220k) + provisional line items |
| 4 | Read **planning flags** | Stonnington stormwater, Yarra heritage, AS 4970 tree protection |
| 5 | **Develop from sketch** | AI zones honour layout + planning notes |
| 6 | Cost → audit → quote | Formal quote; draft permit outputs from flags |

## Why this order

- **Envelope sketch** establishes *where* things go — client scope conversation.
- **Envelope estimate** is deliberately rough — pin counts, not final quantities.
- **Planning flags** tie the sketch to **tree root protection (AS 4970)**, **council stormwater**, and **heritage** — before you over-promise on price or programme.
- **AI design** refines the sketch into specifications; it does not replace TRP or council process.
- **Quote** is contractual; envelope band is “back of the letter” only.

## Planning library (design studio)

| Symbol | Use |
|--------|-----|
| Existing tree (retain) | Canopy to protect — arborist TPZ/SRP |
| Tree protection zone | TRP fence / no-dig area on plan |
| Pool / retaining / paving | Triggers structural & stormwater flags |

Council is inferred from address (Stonnington / Yarra localities). Confirm on certificate.

## API

- `GET /projects/:id/envelope` — budget band + planning flags (live from canvas)
- `POST /projects/:id/costing/sketch` — returns `{ costing, envelope }`
- `POST /projects/:id/pipeline/develop` — AI design after sketch saved

## Outputs linked from flags

- `permit_stonnington_stormwater` — new paving / drainage
- `permit_yarra_heritage` — streetscape / overlay
- `scope` — TRP, engineering, internal scope

## Quote builder (tier-1)

Quote mode opens the editable **`QuoteBuilder`** (desktop two-pane / mobile sheet) —
an override layer over the estimate engine (`resolveQuote` + `QuoteDoc`). Share
freezes resolved `quoteLines` onto `ShareRevision`.

See also [DESIGN_STUDIO.md](DESIGN_STUDIO.md) and
`docs/design-returns/2026-07-27-canvas-asset-menu-and-quote-builder.md`.
