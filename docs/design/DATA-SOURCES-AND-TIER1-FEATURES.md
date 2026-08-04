# Data sources, and tier-1 features engineered from them

Two parts. First, every data source actually wired into this product today —
verified in code, not aspirational. Second, features built by combining them,
ranked by value against effort.

The premise: this app already holds more about a site than any competitor, and
most of it is used once, in isolation, for the narrow purpose it was fetched for.
The value is in the joins.

---

# Part 1 — The sources

## A. Vicmap WFS — `opendata.maps.vic.gov.au/geoserver/wfs`

`apps/api/src/lib/vicmap.ts` discovers layers by name-scoring. Eleven keyless
kinds (easement, planning, bushfire, urban_tree, contour, flood, heritage,
water_corp, road_casement, acid_sulfate, wetland) plus dedicated property/parcel
and building fetchers:

| Source | What it gives | Status today |
|---|---|---|
| property / parcel | Title boundary, PFI, lot area | **Used** — the base drawing |
| building | Dwelling footprint | **Used** — envelope + provenance |
| easement | Approved vs proposed, scored separately | Used as overlay wash |
| planning | Zone + overlay codes | Chip only |
| bushfire (BMO) | Bushfire management overlay | Chip only |
| urban_tree | Council tree records, height, canopy radius | **Used** — tree ghosts |
| **contour** | **Elevation lines** | **Elevation fetched + IDW-interpolated to spot levels** (see below) |
| flood | Flood overlay extent | Overlay wash |
| heritage | Heritage overlay extent | Overlay wash |

## B. Mapbox — `api.mapbox.com`

Geocoding (`/geocoding/v5`) and satellite imagery (`/styles/v1/mapbox/satellite-v9/static`).
The imagery is the input to the canopy vision pass.

## C. Open-Meteo — `api.open-meteo.com`

Two separate calls with different fields:

- `weather.ts:88` — `precipitation_sum`, `temperature_2m_max`, `temperature_2m_min`,
  `wind_speed_10m_max`, `relative_humidity_2m_mean` (daily)
- `site-context.ts:33` — `sunrise`, `sunset`, `daylight_duration`

## D. Computed / derived

- **suncalc** (`lib/sun-shadow.ts`) — sun azimuth and altitude for any date/time
- **Vision canopy** (`canopy-clusters.ts`) — green-blob clustering on the Mapbox tile
- **Anthropic** (`lib/claude.ts`) — design assist plus a second self-audit model pass

## E. Operator-authored

Boundary trace, building trace, spot levels (`z_m`), placed items, irrigation
zones, trenches (`irrig_main`, `irrig_lateral`, `lighting_conduit`, `drainage`
with `depth_mm`), BYDA assets (`sewer`, `stormwater`, `water`, `gas`, `power`,
`nbn` — sourced `byda | traced | assumed`), annotations, phases.

## F. Commercial

Suppliers and catalogue rates, Stripe (deposits), MYOB / Xero (`myob.ts`,
outbound to `api.xero.com`), Resend (email), Twilio (SMS), CRM webhook.

## G. Existing domain modules — the feature-engineering surface

Roughly seventy modules in `packages/domain/src`. The ones that matter for what
follows: `tpz-geometry`, `irrigation`, `irrigation-uniformity`, `lv-lighting`,
`auto-trench`, `drainage-runs`, `carbon`, `costing`, `cad-quantities`,
`spatial-turf`, `spatial-facts`, `flora-suggestion`, `mass-plant`,
`board-sustainability`, `studio-preemptive-compliance`, `live-trade-sourcing`,
`volumetric-isolith`, `growth-temporal-rings`, `weather-condition`.

**The gap is not capability. It is that these run in isolation.**

---

# Part 2 — Engineered features

Each names its inputs, what it produces, why a landscape architect pays for it,
and its build cost.

---

## 1. Buildable Area — the map of where you actually can't build

**Inputs:** boundary + building + easements + BYDA assets + TPZ rings + setbacks
+ flood/heritage/BMO overlays

**Output:** a single computed polygon — the site minus every exclusion — rendered
as a wash, with each subtracted zone individually attributable.

Every one of those constraints already exists in the app and each is displayed
separately. Nobody has subtracted them. A designer currently holds six overlays
in their head and eyeballs the remainder; the app can compute it exactly, and
`spatial-turf.ts` already does boolean geometry.

**Why tier-1:** it is the first question on every job — *where can I actually
put things* — and it is the one nobody has automated. It also makes every
downstream AI proposal legitimate, because the AI can be constrained to the
buildable polygon instead of the lot.

**Effort:** Medium. Boolean ops exist. The work is precedence rules and
attribution — "you lost 34 m² to the sewer easement, 12 m² to TPZ".

---

## 2. Water Balance — irrigation demand against actual rainfall

**Inputs:** Open-Meteo (`precipitation_sum`, `temperature_2m_max`,
`relative_humidity_2m_mean`, `wind_speed_10m_max`) + planting areas + species +
`irrigation.ts` + `irrigation-uniformity.ts`

**Output:** monthly water demand versus local rainfall, the deficit in litres,
and the tank size that would cover it.

You already fetch every variable in the standard evapotranspiration calculation
and use them only for a weather chip. Species water needs already sit in the
catalogue. Zone areas are computed.

**Why tier-1:** Melbourne water restrictions, client running costs, and rainwater
tank sizing is a real deliverable. "This garden needs 47,000 L/year; your roof
catches 62,000 L; a 5,000 L tank covers the summer deficit" is a conversation
that sells tanks and justifies planting choices.

**Effort:** Medium. The maths is standard (FAO-56 reference ET). The data is
already arriving.

---

## 3. Establishment Calendar — when to plant, and when to water

**Inputs:** Open-Meteo forecast + `growth-temporal-rings.ts` + planting plan +
`weather-condition.ts` + phases

**Output:** a planting window per species, and a week-by-week establishment
watering schedule for the first two summers.

**Why tier-1:** plant death in the first summer is the most common warranty
claim in landscape construction. A written establishment schedule shifts
responsibility to the client and reduces replacements. It is also a document
clients pay for and most contractors never produce.

**Effort:** Low. Generated from data you already hold.

---

## 4. Sun Hours Heat Map — the microclimate model

**Inputs:** suncalc + building envelope + neighbouring built form + tree canopies
+ `growth-temporal-rings.ts`

**Output:** annual sun-hours per square metre across the site, shown as a heat
map, with a slider for plant maturity in five years' time.

You compute shadows already. You are not accumulating them. The accumulation is
what turns a pretty overlay into a design instrument.

**Why tier-1:** it is the single most persuasive thing you can show a client, and
it answers the question that determines every planting decision. Coupled to the
maturity slider it also answers *"will this still work when the trees grow?"* —
which nobody can currently show.

**Effort:** Medium-high. Shadow casting exists; accumulation over a year at grid
resolution is the new part.

---

## 5. Constructability Check — the pre-quote sanity pass

**Inputs:** machine access width + fall (from contours) + spoil volume + BYDA
depths + trench routes + TPZ rings

**Output:** a checklist run before the quote goes out, flagging: barrow-only
access, retaining over 1 m needing engineering, trenches crossing a TPZ,
excavation within a BYDA offset, spoil exceeding a truck load.

**Why tier-1:** these are the five things that turn a profitable job into a loss,
and they are all currently discovered on site. This is the feature that pays for
itself in one avoided variation.

**Effort:** Low-medium once contour levels land. It is rules over existing data.

---

## 6. Maintenance and Handover Pack

**Inputs:** planting plan + irrigation zones + lighting circuits + materials +
supplier records + warranty periods

**Output:** a generated handover document — plant schedule with care notes,
irrigation zone map and run times, lighting circuit schedule, material sources
for future repair, warranty dates.

**Why tier-1:** it is a billable deliverable that costs nothing to produce
because every input is already in the model. It is also the thing that gets you
referred, because the client still has a usable document in three years.

**Effort:** Low. Assembly, not computation.

---

## 7. Carbon and Canopy Statement

**Inputs:** `carbon.ts` + species + canopy at maturity + hardscape areas +
material embodied carbon + council canopy targets

**Output:** net carbon position and canopy contribution against the local
council's target.

**Why tier-1:** Melbourne councils have published canopy targets and increasingly
ask for them in planning submissions. `carbon.ts` exists; connecting it to
maturity canopy and a council target makes it a submission document rather than
a number.

**Effort:** Low-medium. The module exists.

---

## 8. Live Buildability for the AI

**Inputs:** feature 1 (buildable area) feeding `studio-ai-assist.ts`

Not a user-facing feature — a constraint on every other one. Today the AI
proposes into the lot. It should propose into the buildable polygon, and every
proposal should be able to state which constraint shaped it.

**Why tier-1:** it turns AI output from decorative to defensible, and it is the
difference between suggestions a designer deletes and suggestions a designer
accepts.

**Effort:** Low, once feature 1 exists.

---

# Ranking

| # | Feature | Value | Effort | Blocked by |
|---|---|---|---|---|
| 1 | Buildable Area | Very high | Medium | — |
| 5 | Constructability Check | Very high | Low-med | Contour levels |
| 3 | Establishment Calendar | High | **Low** | — |
| 6 | Maintenance Pack | High | **Low** | — |
| 2 | Water Balance | High | Medium | — |
| 4 | Sun Hours Heat Map | High | Med-high | — |
| 8 | AI Buildability | High | Low | Feature 1 |
| 7 | Carbon / Canopy | Medium | Low-med | — |

**Start with 1.** It unlocks 5 and 8, it answers the first question on every job,
and every input already exists and is already drawn separately.

**Then 3 and 6** — both are low effort, both are billable deliverables, and
neither needs new data or new geometry. They are assembly work over a model you
have already built.

---

# The pattern worth noticing

Almost none of this needs a new data source. It needs the sources you already
fetch to be **joined**, and the results **drawn on the canvas** rather than
reported in a dock.

The two "small fixes" this doc originally named are both already done:

- **Contour elevations** are fetched (`fetchKeylessRings` returns `elevations[]`
  for contour kind) and IDW-interpolated to spot levels at boundary corners via
  `contour-levels.ts` (`deriveCornerLevels`). `DesignKeylessOverlaySchema` has no
  elevation field by design — elevation is consumed into a separate
  `derived_levels` path, not stored per-overlay.
- **Trench lengths** are computed from polylines
  (`auto-trench.ts:trenchLineItems` calls `polylineLengthFromCanvasPercent`,
  producing BOM lines with `length_m`, `volume_m3`, `depth_mm`).
