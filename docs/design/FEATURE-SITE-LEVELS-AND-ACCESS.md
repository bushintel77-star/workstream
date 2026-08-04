# Feature spec — contour-derived levels, and machine access

Two features for the Curtis & Co studio. They are unrelated in mechanism but share
a purpose: turn data the app already holds into numbers that change what gets
quoted.

Both are grounded in the current code with file and line citations. Where a claim
is an assumption it is labelled.

---

## Feature 1 — Site levels from Vicmap contours

### The problem

The app fetches Vicmap contour data and throws the useful part away.

`apps/api/src/lib/keyless-job.ts` fetches contours as one of six "keyless"
overlays (planning, bushfire, contour, flood, heritage, urban tree). But the
contract it writes to keeps only geometry:

```
packages/contracts/src/schemas/catalog.ts:505-510
export const DesignKeylessOverlaySchema = z.object({
  kind: KeylessOverlayKindSchema,
  rings: z.array(z.array(DesignSiteFramePointSchema)).default([]),
  label: z.string().optional(),
  fetched_at: z.string().datetime().optional(),
});
```

**There is no elevation field.** A contour is a line of constant height, and the
height is the only thing that makes it a contour rather than a squiggle. The WFS
feature carries it as an attribute; `keyless-job.ts` keeps `kind`, `rings` and
`label` and discards the rest.

So downstream, contours can only be decoration, and that is exactly what happens:

```
apps/web/src/components/canvas/handoff/features/keyless/KeylessOverlayWash.tsx:207
if (ov.kind === "contour" || ring.length < 3) { … }   // early-out, wash only
```

and `TactileGround.tsx:89` is explicit — *"Soft topo-ish contours — generative
context, not survey contours."*

Meanwhile the parts of the product that need levels ask the operator to type them
in by hand:

```
packages/domain/src/board-sustainability.ts:559
"Fewer than two spot levels authored — fall, drainage direction and cut/fill
 cannot be read from this board."

board-sustainability.ts:581-584
/* Order-of-magnitude earthworks volume from fall × outdoor area.
   Average depth ≈ fall/4 (conservative wedge) — never a cut/fill schedule. */
```

So: the app downloads level data, discards the levels, then asks the user for
levels, then estimates earthworks from a wedge approximation. Closing that loop
is the whole feature.

### What it delivers

Four things, in dependency order. Each is useful alone.

**Fall across the site.** The single most consequential number in landscape
construction. Determines whether you are building steps, a retaining wall, or
nothing.

**Drainage direction.** Which way water runs, and where it collects. Drives
where drains go and where you must not put a sunken terrace.

**Cut and fill volume.** Currently a wedge estimate. With contours plus proposed
levels it becomes a computed figure. Spoil cartage is among the most commonly
under-quoted line items on a sloping site, and the Quote surface already has
"Spoil haul — tipper loads".

**Retaining flag.** Where a proposed level change exceeds a threshold, flag it.
In Victoria a retaining wall over 1 m generally requires engineering and often a
building permit — a cost and programme item that must not be discovered on site.

### Implementation

**Step 1 — stop discarding the elevation.**

Add an optional elevation to the overlay contract:

```
DesignKeylessOverlaySchema
  elevation_m: z.number().optional()   // contour RL; absent for other kinds
```

Then carry the WFS attribute through `keyless-job.ts`. Vicmap contour layers
typically expose the height as an `altitude` / `elevation` attribute — **verify
the actual attribute name against the live layer before writing the mapping, and
report it.** Do not guess.

One ring per elevation. If the layer returns multiple rings at one height, keep
them as separate entries rather than merging.

**Step 2 — interpolate a level at a point.**

Given contour rings with elevations, the level at an arbitrary board point is a
distance-weighted interpolation between the two nearest contours of differing
elevation. This is a pure function and belongs in `packages/domain` beside the
existing geometry helpers, fully unit-testable with synthetic contours.

Do **not** build a TIN. `docs/STUDIO-PRODUCT-PHASES.md` puts true survey-grade
CAD in Stage 2; this is Workflow 1 and the output is explicitly indicative.

**Step 3 — feed the existing consumers.**

`board-sustainability.ts` already computes fall, drainage and cut/fill from spot
levels. Give it derived levels as a *fallback* when fewer than two spot levels
are authored, never as an override. An operator-authored RL always wins over an
interpolated one — same precedence rule as `resolveSiteAddress` and the lot-area
fix.

**Step 4 — provenance, non-negotiable.**

Vicmap contours are commonly 1 m or 5 m interval. On a 600 m² courtyard that is
too coarse to design from; on the Heathcote rural block it is genuinely useful.
The number must always carry its source and its interval:

```
"Fall ≈ 1.4 m across the site · indicative, from Vicmap 1 m contours ·
 confirm with spot levels before setting out"
```

Never render a derived level in the same ink as an authored one. Use the
line-weight ladder (`features/render/lineWeight.ts`) — derived levels are
`construction` weight, authored levels are `dimension`.

### Acceptance

- Contour elevations survive the fetch and appear on `DesignKeylessOverlay`.
- Level interpolation is a pure function in `packages/domain` with unit tests
  covering: point between two contours, point outside the contour set, single
  contour (must return null, not a guess), and contours with equal elevation.
- Fall and drainage populate when contours exist and no spot levels are authored.
- Authored spot levels always override derived ones — asserted by test.
- Every derived figure renders with source and contour interval.
- No derived level ever feeds a set-out dimension or a retaining wall height
  without an explicit operator confirmation step.

### Open questions

1. What is the actual elevation attribute name on the Vicmap contour layer, and
   what interval does it return for metropolitan vs rural parcels?
2. Should derived levels populate the drainage-run feature
   (`DesignSiteFrameDrainageRunSchema`, which already carries `z_m` per point),
   or stay separate? That schema currently declares `source: "indicative"` —
   which suggests it was built for exactly this.

---

## Feature 2 — Machine access check

### The problem

Whether a bobcat can reach the rear of a site changes the labour cost of
everything that follows. If the narrowest point between the dwelling and the
boundary is under roughly a metre, every cubic metre of spoil and every tonne of
paving is moved by wheelbarrow, and the labour on excavation, base and paving
multiplies.

Right now that is eyeballed on site, or missed. It is the assumption that most
often makes a quote wrong, and it is fully computable from geometry the app
already holds: the title boundary and the building footprint.

### What it delivers

One number and one classification, surfaced on the plan and on the quote:

```
Machine access · 820 mm · barrow only · narrowest at the south side
```

Bands (verify against Curtis & Co's actual plant before fixing the thresholds —
these are the shape, not the answer):

- under ~800 mm — barrow only
- ~800 mm to ~1.2 m — narrow-access machine (mini loader / dingo)
- over ~1.2 m — standard bobcat access

### Implementation

Compute the minimum distance between the building footprint ring and the
boundary ring, restricted to the corridor between the street frontage and the
rear yard. Report the value **and its location**, because "820 mm on the south
side" is actionable and "820 mm" is not.

Two refinements that matter in practice:

- **Fences and gates are not in the footprint.** The computed gap is the
  theoretical maximum; a gate post or meter box reduces it. Label it as such and
  let the operator override with a measured value.
- **Both sides.** Report the wider of the two side paths, since that is the one
  the machine would use — but show both, because the narrow side often
  constrains where spoil can be staged.

This is a pure geometry function. It belongs in `packages/domain` beside the
other ring helpers and is trivially unit-testable.

### Where it surfaces

**On the plan** as an annotation at the pinch point, at `construction` line
weight per the ladder.

**On the quote**, as a visible assumption. This is the important one. If the
quote says "assumes machine access to rear — 1.4 m at narrowest", then a site
that turns out to be gated at 700 mm is a documented variation rather than an
argument. That single line protects margin more than any other item in this
document.

**In the AI cue**, once the boundary and building are both present: *"Access to
the rear is 820 mm — barrow only. Shall I price the excavation accordingly?"*

### Acceptance

- Pure function in `packages/domain` returning `{ widthM, sideLabel, band }`.
- Unit tests: wide open site, pinched one side, building touching boundary
  (returns 0 and a "no side access" band), no building present (returns null,
  not a guess).
- The figure renders on the plan and appears as a written assumption on the
  quote.
- Operator can override with a measured value; the override is marked as
  measured and wins over the computed one.

### Open question

What plant do Curtis & Co actually run? The thresholds should match their
machines, not generic ones. Ask before fixing the numbers.

---

## Sequencing

Machine access first. It is a pure geometry function over data that already
exists, has no schema change, no external dependency, and directly protects
quote accuracy. Days, not weeks.

Contour levels second. It needs a contract change, a WFS attribute
investigation, and an interpolation function — but it unlocks fall, drainage,
cut/fill and retaining flags together, and stops the operator hand-entering
levels the app already downloaded.
