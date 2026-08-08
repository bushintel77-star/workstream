# Deliverables specification — client-facing turnkey proposal (2026 Tier-1)

**From:** Design & Architecture (Claude)
**Date:** 2026-07-27
**Purpose:** Close the open questions on *what the app must output* for a full turnkey bundled
offering — elevation and section counts, naming, aspects, 2D/3D flat lay, services documentation,
and the artistic register. Companion to `2026-07-27-fit-sheet-render-brief.md`.

Every answer below is a **product decision**: it defines a deliverable Workstream generates.

---

## 1. Elevations — how many, and named how

**Quantity:** minimum **4 exterior boundary elevations** + **2–4 internal experiential
elevations**, scaling with site geometry. For 12 Wrights Terrace-scale urban lots, 4 + 2 is the
floor.

**Naming:** narrative, never sequential ("Elevation 1/2/3" is mid-market). Each name states what
the drawing argues:

| Elevation | What it communicates | Primary audience |
| --- | --- | --- |
| **Streetscape elevation** | Public-facing boundary against street rhythm, setbacks, heritage context | Council, design review |
| **Arrival elevation** | Entry sequence — driveway gradient, gates, framing of the facade | Client |
| **Rear boundary elevation** | Private outdoor living → property limit; privacy screening, borrowed scenery | Client, neighbours |
| **Focal feature elevation(s)** | One highly-detailed intervention (e.g. "Bluestone terrace elevation", "Pleached screen elevation") | Hardscape contractor, fabricator |

**App implication:** `ElevationBoard` must support a **named, operator-chosen set** (a stack /
filmstrip), not a single look. Names are editable strings with those four as presets.

---

## 2. Sectionals — how many, and which cuts

**Quantity:** minimum **3 primary sections**; up to **6** on undulating or terraced sites.
Sections are the highest-value technical drawings — they carry grade, drainage and cost logic.

| Section | Cut | Purpose |
| --- | --- | --- |
| **Longitudinal site section** | Continuous cut along the longest axis | Overall drainage strategy, terracing logic, high→low relationship |
| **Transverse site section** | Perpendicular, across the secondary axis | Cross-slopes, boundary retaining |
| **Micro-detail sections** (1–4) | Localised through an assembly | Stratification: waterproofing, drainage mat, growing media, root volume, deck interface |

**App implication:** sections need a **datum line + RL spot heights + stratification hatch**, and
a plan-side **section marker** (A–A′) keyed to each. This is the biggest current gap — the
elevation view is a silhouette with no datum, levels, or section keys.

---

## 3. Aspect — cardinal or best aspect? Both, for different jobs

This is the decision that most often gets conflated. Split it:

- **Technical / analytical output → strict cardinal N/S/E/W.** Microclimate, solar trajectory
  across solstice/equinox, prevailing wind, shading loads, plant viability. Must be complete and
  rigorous. (Our shade grid + sun-cast already work this way — keep it cardinal.)
- **Client-facing renders → "best aspect", curated.** Clients don't experience a site on a
  compass grid; they move through sequences and focal points. Forcing a rote four is a
  pedagogical error. Pick the vantage with the highest emotional and spatial payoff — e.g. a
  south-west view catching golden hour across the terrace, or an off-axis framing that captures a
  borrowed landmark plus the foreground planting.

**App implication:** the aspect selector must offer cardinal presets **and** free/best-aspect
choice, and the proposal should state that microclimate analysis covers all cardinal orientations
while presentation views are curated. Do **not** hard-code four elevations.

---

## 4. Flat lay — 2D or 3D? Both, targeted by audience

- **2D plan** — indispensable and non-negotiable for permitting, contractor layout, dimensions,
  property lines, areas. Goes in the **technical appendix**.
- **3D axonometric / isometric flat lay** (tilt 30° or 45°, extruded, no perspective convergence)
  — for the **client presentation**. Lay clients struggle to read a flat circle as a mature
  canopy; axo preserves plan legibility while conveying vertical hierarchy.

**App implication:** ship both from one geometry — our existing tilt is axonometric, which is
exactly right (no perspective camera needed). Rule: rigorous 2D CAD for the appendix, rendered
axo for the client pages.

---

## 5. Artistic register — is hand-drawn ideal? Which style?

**Yes — for concept and schematic phases.** Photoreal too early triggers *design lock-in* /
"hallucination of finality": the client treats the image as final and fixates on a shrub species or
paver hue instead of layout and circulation. Hand-drawn signals fluidity and invites
collaboration. Modern method is hybrid: sketch over a dimensionally accurate model (our
Rough.js-over-vectors pen is exactly this).

**Style: greyscale/graphite base + ONE selective accent.** The desaturated base states
topographic reality calmly; the single accent asserts total control over visual hierarchy.

| Accent | Psychology | Use when the narrative is |
| --- | --- | --- |
| **Muted cherry** (desaturated earthy red / blossom, **not** primary red — primary reads as danger/warning) | Warmth, organic vitality, intimacy, shelter | The heart of the scheme is social/botanical — a feature tree, a terrace, a pavilion |
| **Pale blue** | Serenity, cooling, atmospheric depth; enhances aerial perspective, pushes horizons back and makes tight urban sites feel larger | Hydrology-led — pools, bioswales, water features; or a constrained courtyard that needs to feel bigger |

Never a full-saturation palette — it causes visual fatigue and reads mid-market. Selective colour
is what gives a proposal its bespoke, fine-art quality.

**App implication:** both accents ship as selective-colour variants; the operator picks per project
narrative. Chrome-side this is already our law (neutral + one signal).

---

## 6. Turnkey services — what must be documented

A turnkey bundle means the firm owns the whole lifecycle and coordinates sub-consultants (civil,
geotechnical, arborist). The proposal must specify exterior MEP to a technical standard, not
gesture at it.

**Low-voltage lighting**

| Spec | Requirement | Why |
| --- | --- | --- |
| Colour temperature | **2700K warm white** | 3000K+ is blue-shifted and renders foliage unnatural |
| Transformer | **IP67**, multi-tap 12V–15V | Dust/immersion rated; taps offset voltage drop on long runs |
| Cable | **12/2 or 14/2 direct-burial** | Minimises drop; size at total wattage × 1.2 for loss |
| Fixtures | Full-cutoff path lights; narrow-beam bullet uplights | Dark-sky compliance, no glare; focused specimen lighting |

**Smart irrigation**

- **ET (evapotranspiration) controllers** — adjust daily from weather, solar radiation, humidity,
  wind; fixed timers are obsolete for 2026 water compliance.
- **Commercial-grade backflow preventers** — legally mandated; stop fertiliser/pesticide-laden
  water re-entering potable supply.

**App implication:** these belong in the quote as real line items + a services sheet with a
legend, and the lighting/irrigation zones should render on the plan (we already have irrigation
zones and trench/service corridors — extend to fixtures with beam/type symbols).

---

## 7. Legal / expectation framing (must appear in output)

- **Plant mortality + growth disclaimer** — biological assets depend on post-install maintenance,
  weather and pathogens; no guarantee past warranty.
- **Unforeseen subterranean conditions** — unmarked services, contamination, rock.
- **Waiver of consequential damages.**
- Keep the standing honesty copy: *indicative, not a construction drawing; confirm before tender.*

---

## 8. 2026 UX and design trends (what to adopt, what to avoid)

**Adopt**

- **Temporal rendering — Year 1 / Year 5 / Year 10.** The single highest-trust feature. Clients
  who see mature canopies then receive one-gallon saplings feel deceived. Show installation
  sparsity honestly, then establishment, then maturity — it sells the long-term investment.
  (We model growth stages already; surface as sheet variants.)
- **Biophilic design + blue-green infrastructure ("sponge city")** — bioswales, rain gardens,
  permeable paving; on-site capture and infiltration, heat-island mitigation.
- **SITES v2 (Sustainable SITES Initiative, GBCI)** alignment — quantifies outcomes (biodiversity
  net gain, embodied carbon, soil protection) and defeats greenwashing claims; yields property
  premiums.
- **Digital twin / WebGL client portal** — client navigates the design, scrubs time of day for
  accurate shadow casting, toggles lighting, switches material palettes. Our share/portal path is
  the natural home; time-of-day and lighting toggles are already partly built.

**Avoid**

- **Generative AI in binding client output.** Diffusion models hallucinate botanically —
  incompatible traits, species wrong for the climate zone. If a client expects an AI-invented
  flowering tree, that's a breach of expectation and real liability. Use AI for internal ideation
  only; final client visuals stay human-controlled and ecologically accurate. (This matches the
  repo's existing zero-mock / ghosts-need-confirmation law.)
- **Photoreal-first presentation** (see §5), and rote cardinal renders for client pages (§3).

---

## 9. Gap summary — what Workstream must build to meet this standard

| Gap | Current state | Required |
| --- | --- | --- |
| Named elevation set | Single look, no naming | 4 exterior + 2–4 experiential, narrative names, filmstrip |
| Sections | Absent | 3–6: longitudinal, transverse, micro-detail with datum + RL + stratification |
| Section keys | Absent | Plan-side A–A′ markers keyed to sections |
| Aspect model | Single look | Cardinal presets (technical) + free best-aspect (client) |
| 3D flat lay | Axonometric tilt exists | Render it as a presentation axo page |
| Selective colour | Not implemented | Muted cherry + pale blue variants over greyscale |
| Hand-drawn pen | Not implemented | Rough.js seeded, across plan/elevation/axo |
| Services documentation | Zones/trenches partial | Lighting fixtures + ET irrigation as symbols, schedule, quote lines |
| Temporal Y1/5/10 | Growth model exists | Sheet variants |
| Disclaimers | Honesty copy present | Add mortality / subterranean / consequential-damages clauses |
