# Pre-construction site infrastructure — landscape architect due diligence

**Audience:** Curtis & Co operators / landscape architects documenting a Melburne
residential site **before landscape construction**.  
**Purpose:** Every item you must know and record — and whether Workstream can
**automate it like Vicmap title** (keyless WFS INTERSECTS → canvas).

**Title hydrate pattern (reference):**  
`opendata.maps.vic.gov.au` GetCapabilities → discover layer → `INTERSECTS` pin /
title ring → canvas-metre co-register → `site_frame` / board overlays.

---

## How to read the columns

| Auto status | Meaning |
| --- | --- |
| **LIVE** | Automated today (same stack as title) |
| **KEYLESS** | Public Vicmap/DELWP WFS exists — next hydrate candidate |
| **LINK** | Open web tool / report (not GeoJSON into canvas yet) |
| **BYDA** | Before You Dig Australia — membership / enquiry, not keyless |
| **COUNCIL** | Council GIS, drainage register, or permit counter |
| **SURVEY** | Licensed surveyor / feature survey / levels |
| **ARBOR** | Consulting arborist (AS 4970) |
| **ENG** | Civil / hydraulic / geotech engineer |
| **SITE** | Walk the site — cannot be replaced by GIS |
| **MANUAL** | Operator Servc / Trace / Level / notes in studio |

---

## A. Legal title & cadastral (must document first)

| # | What LA must know | Why before construction | Auto | Workstream / source |
| --- | --- | --- | --- | --- |
| A1 | **Title boundary / lot** | Working area, setouts, neighbour interface | **LIVE** | Vicmap `property_view` → `site_frame.boundary` |
| A2 | **Parcel attrs** (PFI, SPI, LGA, propnum) | Planning property report, authority routing | **LIVE** | Vicmap attrs → title block |
| A3 | **Lot area** | Permeability, outdoor %, quote envelope | **LIVE** | Vicmap / survey `lot_area_m2` |
| A4 | **Existing dwelling footprint** | Outdoor workable area, shade, setbacks | **LIVE** | Vicmap `building_polygon` → `building` |
| A5 | **Title easements** (drainage, carriageway, etc.) | No-build / dig restrictions; BOE permits | **LIVE** | Vicmap `easement` lines → Services corridors *(subset)* |
| A6 | **Proposed / pending easements** | Future restrictions | **KEYLESS** | `v_s_easement_proposed` |
| A7 | **Certificate of Title + plan of subdivision** (≤28 days) | Encumbrances, covenants, easement beneficiaries | **LINK** | Landata / conveyancer — PDF, not WFS |
| A8 | **Covenants / 173 agreements / body corporate** | Species, fence, hardscape bans | **SITE** / conveyancer | Notes only |
| A9 | **Road casement / frontage** | Crossover, nature strip works | **KEYLESS** | `road_casement_polygon`, `tr_road` |
| A10 | **Crown / tenure quirks** | Rare residential | **KEYLESS** | `cl_tenure_*` |

---

## B. Underground & above-ground services (construction killer list)

| # | What LA must know | Why | Auto | Path |
| --- | --- | --- | --- | --- |
| B1 | **Sewer main / house connection** | Excavation, beds, retaining, pools | **BYDA** | Water authority plans via BYDA |
| B2 | **Stormwater drain / legal point of discharge** | Drainage design, pits, charged lines | **BYDA** + **COUNCIL** | BYDA + council drainage register |
| B3 | **Council drainage (often not on title)** | Rear pits, legacy drains | **COUNCIL** | Engineering request early |
| B4 | **Potable / recycled water mains** | Dig, irrigation tee-offs | **BYDA** | Water corp |
| B5 | **Gas** | Dig, BBQ, heater | **BYDA** | Multinet / AGN etc. |
| B6 | **Electricity (UG + OH)** | Dig, lighting, pool equip; OH clearances | **BYDA** + **SITE** | UG via BYDA; OH poles **SITE** |
| B7 | **NBN / telecom / fibre** | Dig, pits | **BYDA** | NBN Co / Telstra |
| B8 | **Title easement lines** (as registered) | Not the same as asset location | **LIVE** | Vicmap easement *(incomplete)* |
| B9 | **Pits, MH, valves, meters, hydrants** | Avoid / protect / relocate cost | **BYDA** + **SITE** | Asset plans + walkover |
| B10 | **Depth, diameter, material, owner** | Dig method, BOE, quote risk | **BYDA** / **ENG** | Never on Vicmap easement attrs |
| B11 | **Overhead service drops / aerial bundling** | Tree work, crane, screens | **SITE** | Photo + note |
| B12 | **Street lighting / power poles in verge** | Crossover, planting | **SITE** / **KEYLESS** coarse | `temaki-utility-pole` manual; road layers |
| B13 | **Oil/gas transmission / major pipeline** | Rare residential exclusion | **KEYLESS** (industrial) | `pipeline`, `oilgas` — flag only |
| B14 | **DBYD / BYDA enquiry lodged + plans on file** | Mandatory dig practice | **BYDA** | Lodge → upload plans to project |

**Rule:** Never treat Vicmap easement lines as “all underground services.”  
**Rule:** No dig without current BYDA plans on the job.

---

## C. Trees, vegetation & root protection

| # | What LA must know | Why | Auto | Path |
| --- | --- | --- | --- | --- |
| C1 | **Existing trees on site** (species, height, crown, DBH) | Retain/remove, TPZ, cost | **MANUAL** + later **KEYLESS** | Survey Add `exist`; seed from `tree_urban` |
| C2 | **Neighbour trees with TPZ into site** | AS 4970 encroachment | **SITE** + **ARBOR** | Place `exist` near boundary |
| C3 | **TPZ (AS 4970)** | Hardscape / dig bans | **LIVE** (once `exist`+DBH) | Auto ring on board |
| C4 | **SRZ (structural root zone)** | Critical root protection | **ARBOR** | Derive  from DBH later |
| C5 | **Significant / protected / SLO trees** | Planning permit | **KEYLESS** + **COUNCIL** | Overlays + local Significant Tree Register |
| C6 | **Urban canopy / height model** | Massing, shade intent | **KEYLESS** | `tree_urban` (`canopy_radius_m`, `height_m`) |
| C7 | **Vegetation to remove vs retain** | Demo scope, fauna | **SITE** | Sketch/CAD notation |
| C8 | **Native vegetation / biodiversity overlays** | Offset, clearance | **KEYLESS** | `key_biodiversity_areas`, planning overlays |

---

## D. Planning, heritage & environmental overlays

| # | What LA must know | Why | Auto | Path |
| --- | --- | --- | --- | --- |
| D1 | **Planning zone** (GRZ, NRZ, …) | Use, permit triggers | **KEYLESS** / **LINK** | `plan_zone` · VicPlan report |
| D2 | **Overlays** (SLO, HO, DDO, ESO, LSIO, BMO, EAO…) | Design constraints | **KEYLESS** / **LINK** | `plan_overlay` · VicPlan |
| D3 | **Bushfire Prone Area** | Species, materials, BAL | **KEYLESS** | `bushfire_prone_area` |
| D4 | **Heritage register / inventory** | Fabric, materials, visibility | **KEYLESS** | `heritage_register`, `heritage_inventory` |
| D5 | **Flood / inundation history** | Levels, materials, drainage | **KEYLESS** | `vic_flood_history_public` (+ LSIO via overlays) |
| D6 | **Environmental Audit Overlay / contamination cues** | Soil import/export, dig | **LINK** | Victoria Unearthed / EPA |
| D7 | **Acid sulfate soils** (coastal) | Spoil handling | **KEYLESS** | `coastal_acid_sulphate_soils` |
| D8 | **Council setbacks** (front/side/rear) | Envelope | Indicative on canvas | Studio setback overlay — confirm scheme |
| D9 | **Build-over-easement (BOE) need** | Structures / paving over drain easement | **COUNCIL** + **ENG** | After A5 + B2/B3 |
| D10 | **Neighbour amenity** (overlooking, shared fences) | Screens, heights | **SITE** | Notes / elevation photo |

---

## E. Levels, drainage & ground (physical)

| # | What LA must know | Why | Auto | Path |
| --- | --- | --- | --- | --- |
| E1 | **Spot levels / AHD or RL** | Falls, retaining, outdoor FFLs | **MANUAL** | Survey **Level** tool |
| E2 | **Contours / DEM** | Cut-fill, falls | **KEYLESS** coarse | `el_contour`, `el_contour_1to5m` |
| E3 | **Surface drainage paths / low points** | Ponding, french drains | **SITE** + E1 | Sketch arrows / Servc |
| E4 | **Legal point of discharge** | Stormwater design | **COUNCIL** | Drainage advice letter |
| E5 | **Soil type / bearing / fill** | Pavements, planting, spoil | **KEYLESS** coarse + **ENG** | `soil_type`; geotech if retaining/pool |
| E6 | **Existing hardscape / paving / walls** | Demo, reuse | **SITE** | Trace / photo |
| E7 | **Retaining / batters on or adjoining** | Engineering, neighbour | **SITE** + **ENG** | Notes |
| E8 | **Groundwater / restricted-use zones** | Dig, tanks | **LINK** | Victoria Unearthed groundwater |
| E9 | **Wetland / watercourse proximity** | Buffer, permits | **KEYLESS** | `hy_watercourse`, `wetland_*` |

---

## F. Access, street & construction logistics

| # | What LA must know | Why | Auto | Path |
| --- | --- | --- | --- | --- |
| F1 | **Vehicle crossover / street trees in verge** | Delivery, crane, council permits | **SITE** + **COUNCIL** | Photo + notes |
| F2 | **Footpath / kerb / nature strip** | Reinstatement | **SITE** | — |
| F3 | **Site access width / height clearances** | Machinery, spoil | **SITE** | — |
| F4 | **Skip / spoil / washout location** | Construction management | **SITE** | — |
| F5 | **Adjoining buildings within ~3 m** | Excavation, TPZ, fence | **KEYLESS** partial | Neighbour `building_polygon` |
| F6 | **Rail / tram / airport overlays** (rare) | Noise, height | **KEYLESS** | `tr_rail*`, airport layers |

---

## G. Climate & microclimate (design, still document)

| # | What LA must know | Why | Auto | Path |
| --- | --- | --- | --- | --- |
| G1 | **Sun / shade over seasons** | Planting, outdoor rooms | Indicative **LIVE** | Studio shade grid (not EnergyPlus) |
| G2 | **Prevailing wind / exposure** | Screens, species | **SITE** | Notes |
| G3 | **Views to retain / block** | Privacy, heritage | **SITE** | Elevation / photo scrap |
| G4 | **Aspect / orientation** | — | Derived | Boundary + north |

---

## H. Water authority & irrigation context

| # | What LA must know | Why | Auto | Path |
| --- | --- | --- | --- | --- |
| H1 | **Water corporation** (YVW, SEW, MW…) | Applications, meters | **KEYLESS** | `water_corp` polygon |
| H2 | **Meter location / backflow** | Irrigation connection | **SITE** + **BYDA** | — |
| H3 | **Existing irrigation / drip** | Reuse vs rip-out | **SITE** | Zone tool if re-authoring |

---

## Automation roadmap (priority for Workstream)

Ordered by landscape-construction risk × keyless feasibility:

| Priority | Item | Auto status | Canvas destination |
| --- | --- | --- | --- |
| P0 | Title + dwelling + easement lines | **LIVE** | Boundary / building / Services |
| P1 | Planning zone + overlays (SLO/HO/LSIO/BMO/EAO…) | **KEYLESS** | Council layer + meta |
| P1 | Bushfire prone area | **KEYLESS** | Compliance chip |
| P1 | Urban trees → exist ghosts + canopy | **KEYLESS** | Survey vegetation |
| P2 | Contours (1–5 m) | **KEYLESS** | Ground / Level assist |
| P2 | Flood history + heritage | **KEYLESS** | Horizon / compliance |
| P2 | Water corp + road casement | **KEYLESS** | Title meta / street cue |
| P3 | BYDA lodge + plan ingest | **BYDA** | Typed services + PDF tray |
| P3 | Council drainage register import | **COUNCIL** | Services kind=`council_drain` |
| P4 | Typed service kinds (sewer/gas/SW/NBN…) | Schema | First-class Services |
| — | Soil lab, arborist report, CoT PDF | Never GIS-only | Attachments |

---

## Already wired in Workstream (P0)

| Element | Layer | Lands as |
| --- | --- | --- |
| Title boundary | `property_view` | `site_frame.boundary` |
| Existing dwelling | `building_polygon` | `site_frame.building` |
| Title easement lines | `easement` | `site_frame.services[]` when empty |

Path: survey job · `POST …/boundary/auto-trace` · spatial correction · boot hydrate.

---

## Operator honesty (non-negotiable)

1. Vicmap easements = **subset of title easements**, not asset locations.  
2. **BYDA before dig** — always.  
3. TPZ without measured DBH / arborist = **indicative**.  
4. Shade grid / setbacks = **indicative**, not certificate.  
5. Concept sketch — **not a construction drawing**.

---

## Survey checklist vs full LA pack

Studio Survey **5/5** (boundary, dwelling, trees, levels, services/easements) is the
**minimum digital base**. The tables above are the **full pre-construction pack**
a landscape architect should still chase (BYDA, CoT, council drainage, arborist,
overlays) before excavation and hardscape.

---

*Last updated: 2026-07-24 — landscape pre-construction inventory + Vicmap keyless
status against DELWP Open Data Platform WFS (~501 layers probed).*
