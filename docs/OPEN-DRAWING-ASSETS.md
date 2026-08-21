# Open drawing assets — research shortlist

Honest plan / sketch libraries closest to paid landscape CAD packs.
Not photorealistic — drawing-quality vectors.

## Already in Workstream

Full licence record with retrieval dates and attribution obligations:
[`ASSET-LICENCES.md`](./ASSET-LICENCES.md).

| Pack | Licence | Role |
|------|---------|------|
| [Osmic](https://github.com/gmgeo/osmic) | CC0-1.0 (repo licence) | Clean map / site icons — `OSMIC_LANDSCAPE_SYMBOLS` |
| [PlanZV FNP](https://github.com/geoObserver/PlanZV-FNP) (via import script) | CC0 **claimed, unverified** | German land-use planning marks — `PLANZV_DESIGN_SYMBOLS` |
| [Temaki](https://github.com/rapideditor/temaki) | CC0-1.0 | Plants + hardscape / lighting / furniture — `TEMAKI_PLANT_SYMBOLS`, `TEMAKI_SITE_SYMBOLS` |
| [perfect-freehand](https://github.com/steveruizok/perfect-freehand) | MIT | Pressure-honest ink for sketch pad |

Removed 2026-08-21:

| Pack | Licence | Why |
|------|---------|-----|
| Wikimedia tree SVGs | **CC BY-SA 4.0** | Only obligation-carrying pack in the catalog; attribution and ShareAlike notice reached no client surface |
| [Open Crop Icons](https://github.com/openfarmcc/open-crop-icons) | CC0-1.0 | Never rendered, but the CommonJS re-export shipped ~1.5 MB of it |

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
