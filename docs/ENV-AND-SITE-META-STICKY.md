# Environmental & site meta — gold sticky cards

**Audience:** Curtis & Co operators reading climate / sun / services on the
handoff board without hunting for dials.  
**Pattern:** Small translucent sticky cards on the right (`CameraChrome` dock).
Live meta always on. Expand for controls. Stay until you opt out (×).

---

## Inventory — every environmental factor

| Factor | Status | Live meta source today | Expand / board |
| --- | --- | --- | --- |
| Time of day | **LIVE** | `sunMin` scrubber | Env card → Sun & growth |
| Season / date preset | **LIVE** | equinox / solstice chips | Env card |
| Melb season label | **LIVE** (domain) | `melbourneSeason()` | Env card |
| Growth stage | **LIVE** | plant / 5yr / mature | Env card + glyphs |
| Sun play (day cycle) | **LIVE** | play/pause | Env expand |
| Indicative sun-hours mesh | **LIVE** | 8×8 shade grid avg / deep cells | Mesh on board when armed |
| Solar altitude / azimuth | **LIVE** (domain) | shade-grid math | Env expand (readout) |
| Daylight hours / sunrise–set | **API ready** | `GET …/site-context` | Env card (when fetched) |
| Weather (temp / rain / wind) | **LIVE** | `GET …/weather` → Env sticky + expand | Env card |
| Weather condition glyph | **LIVE** | `weatherConditionFromDay` | Env card |
| Overshadowing / sun cast 12h | **LIVE** | timed dwelling + canopy polygons (`plan-sun-cast`) | Env expand / mesh arm |
| Seasonal sun cast | **LIVE** | date presets drive cast + mesh | Env season chips |
| Sun marker pip | **LIVE** | `sunMarkerOnPlanPercent` at lot centre | Env expanded |
| Climate bed wash | **LIVE** | frost / heat / humidity soft wash | Env expand / mesh |
| Fit sheet weather | **LIVE** | `WeatherIcon` in title strip | Fit sheet |
| Exposed to sun / full-sun band | **LIVE** (flora) | flora ranking at click | Flora Ring |
| Deep shade / dappled | **LIVE** (flora) | shade-grid bands | Flora Ring |
| Decorative plan shadows | **PARTIAL** | static south offset — not timed | Glyph chrome |
| Ghost sun-exposure score | **LIVE** | AI ghost confidence | Ghost review |
| Humidity | **LIVE** | Open-Meteo `relative_humidity_2m_mean` | Env expand |
| Frost risk (plant) | **LIVE** | min temp ≤2° risk / ≤0° hard | Env expand |
| Excessive heat / heat stress | **LIVE** | max ≥32° warm / ≥35° excessive | Env expand |
| Engineering overshadowing | **MISSING** | Stage 2 / survey | Spec only |
| Wind exposure on site | **PARTIAL** | forecast wind warning only | Env weather line |
| Soil moisture / drought | **MISSING** | — | chase / eng |

**Honesty:** shade mesh and sun cast are **indicative Workflow 1** — not EnergyPlus
or neighbour solar rights.

---

## Gold-standard pattern — Cursor-style boundary rail

Like Cursor’s side panel: **flush to the right window boundary**, soft frost
bleeding into the canvas, hard against the edge. Not floating inset cards.

```
                    │ Env · 6.2h · Autumn · mature × │← flush right
 drawing / parchment│ Services · 3 site · 2 design × │
                    │ 412 m² · boundary            × │  ← Site
                    │ Trees · 1                    × │  ← existing trees
                    └────────────────────────────────┘
                              ↓ click
                    │ Expanded Env / Services /       │← same seam
                    │ Site / Trees panel              │
```

Four sticky faces in order: **Environment, Services, Site, Trees**. Site face
reads lot area + cadastral source (`412 m² · Vicmap`, else `… · boundary` /
`Site · boundary`); expand shows dwelling / easements + Vicmap≠assets honesty.
Trees face reads `Trees · N`; expand lists existing survey trees with
indicative AS 4970 TPZ (12 × DBH, min 2 m). Both persist until × and re-summon
via Cmd+K (`Site`, `Existing trees`).

### Rules

1. **Sticky by default** — rail persists across Survey / Sketch / CAD until ×.  
2. **Opt out** — × writes session pref; re-summon via Cmd+K.  
3. **Live meta only on the face** — one line: numbers that change with the board.  
4. **Expand for instruments** — scrubbers, ticks, focus, play — not on the face.  
5. **Lane law for expand** — one expanded panel on the same boundary seam.  
6. **CameraChrome** — rail portals to `camera-chrome-root` (gate C).  
7. **Never** a fixed opaque AutoCAD ribbon or multi-slider Services dial.  
8. **Flush edge** — `right: 0`, radius only on the canvas side.

### Services card (same pattern)

Face: `Services · 2 corridors · 1 easement · locked?`  
Expand: full ledger (ticks, metrics, focus).  
Sticky until × — Esc clears focus / closes expand, **not** the sticky card.

### Env card

Face: `Env · 6.2h sun · Autumn · 1:26 pm · mature`  
Expand: season chips, time scrubber, growth, play, arm mesh, weather glyphs,
humidity %, frost / heat bands from today’s Open-Meteo day. Pending weather
shows `—` (not fake dials). Engineering overshadow stays Stage 2.

---

## Summon map

| Action | Result |
| --- | --- |
| Boot plan mode | Sticky cards on (unless session opted out) |
| Click Services card | Expand ledger |
| Click Env card | Expand env + arm shade mesh |
| × on card | Opt out (session) |
| Cmd+K → Services / Env | Re-summon sticky + expand |
| Esc | Clear focus; close expand; sticky stays |
| Quote lock | Services card shows Survey locked |

---

*Binding with `docs/STUDIO-STYLING-AND-UX.md` (frost glass, disappearing chrome)
and `docs/SITE-INFRASTRUCTURE-AUTOMATED-LINKS.md` (Vicmap ≠ assets).*
