# Pre-construction site infrastructure — landscape architect due diligence

**Audience:** Curtis & Co operators / landscape architects documenting a Melbourne
residential site **before landscape construction**.  
**Purpose:** Every item you must know and record — and whether Workstream can
**automate it like Vicmap title** (keyless WFS INTERSECTS → canvas).

**Title hydrate pattern (reference):**  
`opendata.maps.vic.gov.au` GetCapabilities → discover layer → `INTERSECTS` pin /
title ring → canvas-metre co-register → `site_frame` / board overlays.

---

## Critical distinction (construction)

| Source | What it is | Dig? |
| --- | --- | --- |
| **Vicmap easements** | Title easement geometry (subset) | Not asset location |
| **BYDA** | Sewer / gas / power / NBN / water / SW plans | **Required before dig** |
| **Council drainage** | Often not on title | Often required |

**Rule:** Vicmap easements ≠ underground assets.  
**Rule:** No dig without current BYDA plans on the job (+ council drainage when relevant).

Studio Survey **5/5** (boundary, dwelling, trees, levels, services/easements) is the
**digital minimum**. This document is the **full LA pack** before excavation.

---

## How to read the columns

| Auto status | Meaning |
| --- | --- |
| **LIVE** | Automated today (same stack as title) |
| **KEYLESS** | Public Vicmap/DELWP WFS — next hydrate candidate (scorers landed) |
| **LINK** | Open web tool / report (not GeoJSON into canvas yet) |
| **BYDA** | Before You Dig Australia — membership / enquiry, not keyless |
| **COUNCIL** | Council GIS, drainage register, or permit counter |
| **SURVEY** | Licensed surveyor / feature survey / levels |
| **ARBOR** | Consulting arborist (AS 4970) |
| **ENG** | Civil / hydraulic / geotech engineer |
| **SITE** | Walk the site — cannot be replaced by GIS |
| **MANUAL** | Operator Servc / Trace / Level / notes in studio |

---

## LIVE today

| Item | Canvas destination |
| --- | --- |
| Title boundary / lot | `site_frame.boundary` |
| Existing dwelling | `site_frame.building` |
| Parcel attrs (PFI, SPI, LGA…) | Title block |
| Survey corridors / easements / RLs | Servc · Level → Services ledger |
| Construction trenches (irrig / conduit / drain) | Cmd+K **Auto trench…** → `construction_trenches` |

---

## KEYLESS next (same WFS stack)

Scorers in `apps/api/src/lib/vicmap.ts` (`VICMAP_KEYLESS_SCORERS` /
`discoverKeylessLayerNames`). Hydrate jobs land per layer.

| Item | Status | Notes |
| --- | --- | --- |
| Planning zone / overlays (SLO/HO/LSIO/BMO/EAO…) | **KEYLESS** | Council layer + meta |
| Bushfire prone area | **KEYLESS** | Compliance chip |
| Urban trees / canopy | **KEYLESS** | Exist ghosts + canopy |
| Contours (1–5 m) | **KEYLESS** | Ground / Level assist |
| Flood history / LSIO | **KEYLESS** | Horizon / compliance |
| Heritage overlay | **KEYLESS** | Horizon / compliance |
| Water corporation boundary | **KEYLESS** | Title meta |
| Road casement | **KEYLESS** | Street / crossover cue |
| Acid sulfate soils | **KEYLESS** | Flag only |
| Wetlands | **KEYLESS** | Flag only |
| Title easement lines | **KEYLESS** → LIVE when hydrate ships | Subset — not BYDA |

---

## BYDA (not like title — membership enquiry)

| Item | Status |
| --- | --- |
| Sewer main / house connection | **BYDA** |
| Stormwater assets | **BYDA** (+ council) |
| Water mains | **BYDA** |
| Gas | **BYDA** |
| Power (UG) | **BYDA** |
| NBN / telecom | **BYDA** |
| Pits / MH / valves | **BYDA** + **SITE** |
| Depth / diameter / owner | **BYDA** / **ENG** |

---

## COUNCIL / SURVEY / ARBOR / SITE (must chase)

| Item | Status |
| --- | --- |
| Council drainage register | **COUNCIL** |
| CoT / covenants / 173 agreements | **LINK** / conveyancer |
| Build over easement (BOE) | **COUNCIL** |
| Legal point of discharge | **COUNCIL** |
| Measured RLs (feature survey) | **SURVEY** |
| Neighbour TPZs | **SITE** + **ARBOR** |
| Arborist SRZ | **ARBOR** |
| OH lines / aerial bundling | **SITE** |
| Access / crossover | **SITE** |
| Soil / geotech | **ENG** |
| Contamination (Victoria Unearthed) | **LINK** |

---

## Operator surfaces in studio

1. **Services ledger** (right lane) — live list of corridors, easements, RLs,
   lighting/drip zones, trenches. Ticks = on/off across Survey + CAD. Click =
   focus (others fall away). Multi-select with Shift/Cmd+click. Freezes at Quote.
2. **Auto trench…** (Cmd+K) — landscape dig paths from zones (not BYDA assets).
3. **Survey checklist 5/5** — digital minimum only.

---

*Last updated: 2026-07-24 — Services ledger + KEYLESS scorers + full LA pack.*
