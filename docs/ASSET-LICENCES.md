# Asset licences

Every non-Curtis asset shipped in this repo, with its provenance and whatever
obligation it carries. Written 2026-08-21 after a licence audit; pattern
follows the repo's only prior attribution record,
[`apps/web/public/sfx/materials/ATTRIBUTION.md`](../apps/web/public/sfx/materials/ATTRIBUTION.md).

**Rule this document exists to enforce:** an asset that requires attribution
must have a place where that attribution actually renders to the person
receiving the output — client PDF, share portal, or on-screen credit. An
exported `*_ATTRIBUTION` string constant with no call site is not attribution.
Anything whose provenance we cannot confirm is marked **unverified** here
rather than being given a licence it may not have.

## Retrieval dates are a proxy

No import script recorded a retrieval date. The dates below are the date the
generated file or binary was **first committed** (`git log --diff-filter=A`),
which is the closest honest available proxy. They are upper bounds on when the
asset was fetched, not recorded retrieval timestamps.

## Shipped assets

### Temaki plants — `temaki-*` (planting)

| Field | Value |
|---|---|
| Path / ids | `packages/domain/src/temaki-plant-symbols.ts`, ids `temaki-*` (17 planting glyphs); source SVGs `packages/domain/assets/temaki-plants/` |
| Upstream | https://github.com/rapideditor/temaki |
| Licence | CC0-1.0 (SPDX: `CC0-1.0`) |
| Licence URL | https://creativecommons.org/publicdomain/zero/1.0/ |
| Rightsholder | Temaki contributors (rapideditor) |
| Retrieved | 2026-07-23 (first-commit proxy) |
| Attribution required | No |
| Where attribution renders | Nowhere. `TEMAKI_PLANT_ATTRIBUTION` is exported from `@workstream/domain` and has **zero call sites**. Harmless because CC0, but it is not a working attribution path. |
| Modified | Yes — traced/simplified to `path_d` + `asset.layers` by `scripts/generate-temaki-plants-catalog.mjs`, and `default_width_m` + Curtis keywords added |

### Temaki site — `temaki-*` (hardscape / lighting / furniture)

| Field | Value |
|---|---|
| Path / ids | `packages/domain/src/temaki-site-symbols.ts`, ids `temaki-*` (25 glyphs); source SVGs `packages/domain/assets/temaki-site/` |
| Upstream | https://github.com/rapideditor/temaki |
| Licence | CC0-1.0 (SPDX: `CC0-1.0`) |
| Licence URL | https://creativecommons.org/publicdomain/zero/1.0/ |
| Rightsholder | Temaki contributors (rapideditor) |
| Retrieved | 2026-07-23 (first-commit proxy) |
| Attribution required | No |
| Where attribution renders | Nowhere. `TEMAKI_SITE_ATTRIBUTION` exported, **zero call sites** (as above). |
| Modified | Yes — same generator pipeline as Temaki plants |

### PlanZV FNP — `planzv-*`

| Field | Value |
|---|---|
| Path / ids | `packages/domain/src/planzv-design-symbols.ts`, ids `planzv-*` (17 glyphs); source SVGs `packages/domain/assets/planzv-fnp/` |
| Upstream | https://github.com/geoObserver/PlanZV-FNP |
| Licence | **CC0 claimed — UNVERIFIED.** The in-repo constant `PLANZV_ATTRIBUTION` asserts "CC0 1.0", but nobody has confirmed that against the upstream repository, and the underlying PlanZV symbol set is a German federal planning-notation annex whose own status is not the same question as the repackaged SVGs'. Treat as unresolved until someone reads the upstream licence file. |
| Licence URL | Unconfirmed — do not cite one until verified |
| Rightsholder | Stated in-repo as Stadt Halle (Saale) / IT-Consult Halle; unverified |
| Retrieved | 2026-07-18 (first-commit proxy) |
| Attribution required | Unknown, pending the above |
| Where attribution renders | Nowhere. `PLANZV_ATTRIBUTION` exported, **zero call sites**. If the pack turns out to be CC-BY rather than CC0, this is an open compliance gap, not a cosmetic one. |
| Modified | Yes — traced to `path_d`, resized, keywords added |

Provenance-link note: `docs/OPEN-DRAWING-ASSETS.md` recorded this pack's source
as a bare `https://github.com/` — a dead link that pointed at nothing. It has
been corrected to the `geoObserver/PlanZV-FNP` URL above, taken from the
`PLANZV_ATTRIBUTION` constant. That fixes the link but **not** the licence
question: the CC0 claim is still unverified.

### Osmic — `osmic-*`

| Field | Value |
|---|---|
| Path / ids | `packages/domain/src/osmic-landscape-symbols.ts`, ids `osmic-*` (36 glyphs); upstream consumed via the `osmic-source` devDependency (`github:gmgeo/osmic`), no vendored SVG directory |
| Upstream | https://github.com/gmgeo/osmic |
| Licence | CC0-1.0 for the SVG icons per the repository licence (SPDX: `CC0-1.0`). **The icon *font* built from that repo is SIL OFL 1.1, a different licence with different terms.** We consume the SVGs, not the font — do not import the font on the assumption this row covers it. |
| Licence URL | https://creativecommons.org/publicdomain/zero/1.0/ (SVGs); https://scripts.sil.org/OFL (font, not used) |
| Rightsholder | Michael Glanznig (gmgeo) and contributors |
| Retrieved | 2026-05-25 (first-commit proxy) |
| Attribution required | No (CC0 SVGs) |
| Where attribution renders | Nowhere, and unlike the other packs **no attribution constant is exported at all** — there is no `OSMIC_ATTRIBUTION`. Acceptable under CC0; noted so the asymmetry is not mistaken for an oversight that was already handled. |
| Modified | Yes — converted to `path_d`, `default_width_m` and Curtis keywords added by `scripts/generate-osmic-landscape-catalog.mjs` |

### Poly Haven HDRI — studio environment light

| Field | Value |
|---|---|
| Path | `apps/web/public/hdri/rooitou_park_1k.hdr` (1.51 MB) |
| Consumed by | `apps/web/src/components/canvas/webgl/WebGLStudio.tsx` (R3F `<Environment files="/hdri/rooitou_park_1k.hdr">`) — vendored locally rather than CDN-loaded |
| Upstream | https://polyhaven.com/a/rooitou_park |
| Licence | CC0-1.0 (SPDX: `CC0-1.0`) — Poly Haven licenses all assets CC0 |
| Licence URL | https://polyhaven.com/license |
| Rightsholder | Poly Haven (Greg Zaal / Rico Cilliers et al.) |
| Retrieved | 2026-08-18 (first-commit proxy) |
| Attribution required | No |
| Where attribution renders | Nowhere; a source comment in `WebGLStudio.tsx` records "CC0 from Poly Haven" |
| Modified | No — 1k `.hdr` as published |

### Material Foley SFX

| Field | Value |
|---|---|
| Path | `apps/web/public/sfx/materials/*.ogg` |
| Record | [`apps/web/public/sfx/materials/ATTRIBUTION.md`](../apps/web/public/sfx/materials/ATTRIBUTION.md) — the pre-existing, and until now only, attribution file in the repo. Kept as the detailed per-file record; not duplicated here. |
| Upstream | https://kenney.nl/assets/impact-sounds ; https://opengameart.org/content/100-cc0-metal-and-wood-sfx |
| Licence | CC0-1.0 (SPDX: `CC0-1.0`) both sources |
| Licence URL | https://creativecommons.org/publicdomain/zero/1.0/ |
| Rightsholder | Kenney (kenney.nl); rubberduck (OpenGameArt) |
| Retrieved | 2026-07-20 (first-commit proxy) |
| Attribution required | No — Kenney requests it ("appreciated but not required") |
| Where attribution renders | Nowhere in-product; recorded in the file above only |
| Modified | Yes — renamed to the studio's material families, per that file's mapping table |

### Curtis native

`packages/domain/src/catalog-assets.ts` and `garden-size-ladder.ts` — Curtis &
Co house style, proprietary, no third-party obligation.

## Removed 2026-08-21

### Wikimedia "Set of trees" — `wikimedia-tree-01` … `-13` (REMOVED)

| Field | Value |
|---|---|
| Was at | `packages/domain/src/wikimedia-tree-symbols.ts`; source SVGs `packages/domain/assets/wikimedia-trees/tree-NN.svg` |
| Upstream | https://commons.wikimedia.org/wiki/Category:SVG_trees |
| Licence | **CC BY-SA 4.0** (SPDX: `CC-BY-SA-4.0`) |
| Licence URL | https://creativecommons.org/licenses/by-sa/4.0/ |
| Rightsholder | Heinrich Böll Foundation (Commons upload of artwork extracted from a foundation PDF) |
| Attribution required | **Yes** — plus a ShareAlike notice |
| Where attribution rendered | **Nowhere.** `WIKIMEDIA_TREE_ATTRIBUTION` was exported and had zero call sites, while `isSketchGoldStandard` explicitly whitelisted the `wikimedia-tree-` prefix into the gold library. The glyphs could therefore reach a client PDF or the share portal carrying neither the credit nor the ShareAlike notice. |

Removed rather than fixed. These were traced canopy blobs with a flat
`default_width_m: 6` and no botanical fields — the least useful pack in the
catalog and the only one carrying an obligation. Building a compliant
attribution surface for them was not worth it. Deleted: the generated symbols
file, the 13 source SVGs, both import scripts, the `import:wikimedia-trees`
package script, the `CURTIS_CATALOG_SYMBOLS` merge, the `isSketchGoldStandard`
whitelist entry, the attribution constant, and `docs/WIKIMEDIA-TREES.md`.

Policy consequence, recorded in `OPEN-SOURCE-CAD-LIBRARY-RESEARCH.md`: CC BY-SA
is do-not-adopt here until a rendered notice path exists.

### Open Crop Icons — `opencrop-*` (REMOVED)

| Field | Value |
|---|---|
| Was at | `packages/domain/src/open-crop-symbols.ts` (247 symbols, ~1.5 MB) |
| Upstream | https://github.com/openfarmcc/open-crop-icons |
| Licence | CC0-1.0 (SPDX: `CC0-1.0`) |
| Rightsholder | OpenFarm contributors |
| Attribution required | No |

Removed for weight, not licence. Detail and the regeneration path:
[`OPEN-CROP-ICONS.md`](./OPEN-CROP-ICONS.md).

### Demo PBR textures (REMOVED)

`apps/web/public/demo-assets/` — ~15.8 MB of PBR JPEGs (bark, beds, lawn,
pavers; colour / normal / roughness) added alongside `DemoGarden.tsx` in
`f29871d`. All three consumers were deleted the next day in `283dbd5`, leaving
the textures referenced by nothing.

**Provenance unrecoverable.** The adding commit claimed CC0 but named no
source, no author and no URL, so there is no way to confirm the claim or
attribute the work. Unattributable and unused, so deleted. If PBR material
textures are wanted again, take them from a source with a recorded licence
(Poly Haven and ambientCG both publish CC0 with a citable asset URL) and add a
row to this document at the same time.

## Known gaps

1. **PlanZV's CC0 claim is unverified.** Highest-value follow-up here.
2. **No attribution renders anywhere in-product.** Every remaining pack is CC0
   so nothing is currently owed, but there is no surface to put a credit on if
   a future pack needs one. That absence is what made the Wikimedia pack a
   removal rather than a fix.
3. **No retrieval dates are recorded at import time.** The import scripts
   should stamp one into the generated header; until they do, the dates above
   are first-commit proxies.
