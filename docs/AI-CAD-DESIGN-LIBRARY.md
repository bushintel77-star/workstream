# AI CAD design library (open source)

Quality open-source symbols for site design on the one-canvas studio / AI CAD path.

For **library selection policy** (what not to adopt, DXF / freehand / Rough.js
priorities, licence green/red list), see
[`OPEN-SOURCE-CAD-LIBRARY-RESEARCH.md`](./OPEN-SOURCE-CAD-LIBRARY-RESEARCH.md).

| Pack | Licence | Source | Filter chip |
|------|---------|--------|-------------|
| **PlanZV FNP** | CC0 | [geoObserver/PlanZV-FNP](https://github.com/geoObserver/PlanZV-FNP) | **AI CAD design** |
| **Osmic landscape** | CC0 | [gmgeo/osmic](https://github.com/gmgeo/osmic) | Landscape library / AI CAD design |
| **Temaki plants** | CC0 | [rapideditor/temaki](https://github.com/rapideditor/temaki) | Shrubs / groundcover / trees |
| **Temaki site** | CC0 | [rapideditor/temaki](https://github.com/rapideditor/temaki) | Hardscape / lighting / furniture |
| Curtis native | proprietary house style | `catalog-assets.ts` | (always) |

Removed 2026-08-21 — see [`ASSET-LICENCES.md`](./ASSET-LICENCES.md):

- **Wikimedia trees** (CC BY-SA 4.0). The only obligation-carrying pack in the
  catalog, and its ShareAlike notice reached no client surface. Dropped.
- **Open Crop** (CC0). Never rendered; `isSketchGoldStandard` rejected the
  `opencrop-` prefix, but the CommonJS re-export still shipped ~1.5 MB into a
  production chunk. `import:open-crop` can regenerate it if it is ever wanted.

PlanZV + Osmic + Temaki symbols include `default_width_m` for drafting size assist and keywords `ai cad` / `design library` where applicable.

## Import / regenerate

```bash
pnpm --filter @workstream/domain import:ai-cad-design
# or individually:
pnpm --filter @workstream/domain import:planzv
pnpm --filter @workstream/domain import:osmic-landscape
pnpm --filter @workstream/domain import:temaki-plants
pnpm --filter @workstream/domain import:temaki-site
```

Generated files:

- `packages/domain/src/planzv-design-symbols.ts`
- `packages/domain/src/osmic-landscape-symbols.ts`
- `packages/domain/src/temaki-plant-symbols.ts`
- `packages/domain/src/temaki-site-symbols.ts`
- SVGs: `packages/domain/assets/planzv-fnp/`, `temaki-plants/`, `temaki-site/`

Then rebuild domain: `pnpm --filter @workstream/domain build`.
