# Site infrastructure — automated links (Vicmap-style)

**Status:** Binding inventory of every source we can (or cannot) hydrate
onto the handoff canvas the same way title/dwelling are fetched today.  
**Title path today:** keyless DELWP GeoServer WFS → discover layer via
GetCapabilities → `INTERSECTS` pin/title → canvas-metre co-register →
`site_frame`.

---

## 1. Already automated (keyless, same stack as title)

| Element | Vicmap / open layer | Geometry | Lands on canvas as | Honesty |
| --- | --- | --- | --- | --- |
| **Title boundary** | `property_view` (discovered) | Polygon | `site_frame.boundary` | Vicmap parcel |
| **Existing dwelling** | `building_polygon` | Polygon | `site_frame.building` + `building_source: vicmap` | Hatch · confirm on site |
| **Title easement lines** | `easement` / `v_s_easement_approved` | **LineString** | `site_frame.services[]` corridors + `easement_source: vicmap` | Subset of easements only — confirm title / council |

Endpoint path: survey job + `POST …/boundary/auto-trace` (+ spatial correction / Stage 1).

---

## 2. Automatable next (keyless Vicmap WFS — same discovery pattern)

| Element | Layer(s) on `opendata.maps.vic.gov.au` | Geometry | Proposed canvas home | Notes |
| --- | --- | --- | --- | --- |
| **Proposed easements** | `v_s_easement_proposed` | Line | Services (dashed) | Distinct from approved |
| **Urban trees** | `tree_urban` | Point + `canopy_radius_m`, `height_m` | `exist` symbols + TPZ from canopy/DBH heuristic | Not full AS 4970 DBH; seed ghosts for accept |
| **Tree density / large trees** | `tree_density`, `isc2010_large_trees` | Various | Context / ghosts | Coarse |
| **Planning overlays** | `plan_overlay`, `plm25_overlays` | Polygon | Council layer (IPO/HO/… zones) | Stonnington IPO etc. already seen live |
| **Heritage** | `heritage_register`, `heritage_inventory` | Point/poly | Compliance tip / overlay | Not a build ban alone |
| **Flood history** | `vic_flood_history_public` | Polygon | Compliance / horizon card | Indicative |
| **Hydro watercourse / water area** | `hy_watercourse`, `hy_water_area_polygon` | Line/poly | Context underlay | Rarely on residential lots |
| **Water corporation boundary** | `water_corp` | Polygon | Title meta (authority) | Not a pipe |
| **Cadastre lines** | `cl_cad_line`, `cad_area_bdy` | Line/poly | Debug / advanced | Prefer property_view |

Discovery: extend `score*LayerName` + `discover*Layer()` beside property/building/easement.

---

## 3. Not keyless / not “fetch like title”

| Element | Why it is not Vicmap-title style | Path if we want it |
| --- | --- | --- |
| **Sewer / stormwater / water mains (asset-grade)** | Held by water authorities; not on public Vicmap Property | BYDA enquiry (membership API) → import response plans; or Melb Water GIS if licensed |
| **Gas / electricity / NBN / telecom** | Asset owners via **Before You Dig Australia** | BYDA SmarterWX API (approved credentials, not open WFS) |
| **Dial Before You Dig plans** | PDF/referral packs, not live GeoJSON parcels | Lodge enquiry → operator upload / future BYDA webhook ingest |
| **SRZ (structural root zone)** | Arborist / AS 4970 practice, not a state layer | Derive from DBH once exist tree is placed (smaller disc than TPZ) |
| **Pit / MH / valve inventory** | Authority asset DBs | BYDA plans or manual Servc + point symbols |
| **Depth / diameter / material** | Never on Vicmap easement line attrs (only `pfi`/`status`) | Manual or BYDA attribute import |

**BYDA** can automate *enquiry lodgement* with a membership API — it does **not** replace Vicmap as a keyless INTERSECTS hydrate on project open.

---

## 4. First-class vs automated

| Kind | First-class object today | Auto link |
| --- | --- | --- |
| Title | Yes | Vicmap |
| Dwelling | Yes | Vicmap |
| Easement **line** (title) | Corridor in Services | Vicmap (this workstream) |
| Easement **hatch ring** (operator) | Yes (`easements[]`) | Manual Servc ≥3 pts |
| Untyped underground corridor | Yes (`services[]`) | Manual Servc 2 pts |
| TPZ | Yes (on `exist`) | Manual tree + DBH; later `tree_urban` seed |
| Sewer / gas / power / NBN typed | **No** | BYDA / typed schema later |
| French drain (design) | Yes (`frenchdrain`) | Never auto — design intent |

---

## 5. Operator honesty (copy)

- Vicmap easements: *“Vicmap easement lines — subset of title easements. Confirm survey / council before excavating.”*
- Empty Vicmap easement hit: leave Services empty; checklist still wants operator Servc or levels as needed.
- BYDA: never claim “live underground” without a lodged enquiry.

---

## 6. Implementation checklist

- [x] Inventory of every automated link (this doc)
- [x] Vicmap easement layer discovery + fetch (keyless WFS)
- [x] Co-register into `boundary/auto-trace` → Services corridors
- [ ] `tree_urban` → exist ghosts
- [ ] `plan_overlay` → council overlay rings
- [ ] Typed `service_features[]` (`kind` + `source` + attrs)
- [ ] Optional BYDA lodge + plan ingest (Studio plan / paid)

---

*Last updated: 2026-07-24 — aligns with keyless DELWP GeoServer discovery used for title + dwelling.*
