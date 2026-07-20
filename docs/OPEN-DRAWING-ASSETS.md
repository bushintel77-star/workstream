# Open drawing assets — research shortlist

Honest plan / sketch libraries closest to paid landscape CAD packs.
Not photorealistic — drawing-quality vectors.

## Already in Workstream

| Pack | Licence | Role |
|------|---------|------|
| [Osmic](https://github.com/gmgeo/osmic) | CC0 | Clean map / site icons — `OSMIC_LANDSCAPE_SYMBOLS` |
| [Open Crop Icons](https://github.com/openfarmcc/open-crop-icons) | CC0 | Plant / crop glyphs — `OPEN_CROP_SYMBOLS` |
| [PlanZV FNP](https://github.com/) (via import script) | CC0 | German land-use planning marks — `PLANZV_DESIGN_SYMBOLS` |
| Wikimedia tree SVGs | per-file | Canopy silhouettes — `WIKIMEDIA_TREE_SYMBOLS` |
| [perfect-freehand](https://github.com/steveruizok/perfect-freehand) | MIT | Pressure-honest ink for sketch pad |

## Best next imports (CAD formal)

1. **QCAD Architecture part library** (~600 DXF blocks: plants, people, doors/windows) — free add-on for GPL QCAD; best open stand-in for paid landscape block packs. Convert selectively to SVG for catalog.
2. **OSM Carto patterns** ([symbols/](https://github.com/openstreetmap-carto/openstreetmap-carto/tree/master/symbols)) — CC0 vegetation / wetland / rock hatches for softscape fills.
3. **Inkscape Open Symbols** — MIT aggregator; pick architecture / map subsets only.

## Best for sketch honesty (not CAD)

1. **[Rough.js](https://roughjs.com/)** (MIT) — optional later if we want generative sketchy fills; today we tidy with Chaikin + perfect-freehand instead of remapping to CAD.
2. Keep sketch → tidy on the ink layer; **Formalize to CAD** is the explicit bridge into Osmic / Curtis / PlanZV symbols.

## Principle

- Sketch pad = stripped ink, artist path.
- CAD plate = typed line language + catalog glyphs.
- Never auto-format sketch ink into the CAD library without the formalize step.
