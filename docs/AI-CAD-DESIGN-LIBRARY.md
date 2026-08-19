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
| **Wikimedia trees** | CC BY-SA 4.0 | Heinrich Böll Foundation set | Tree pack |
| **Open Crop** | CC0 | openfarmcc/open-crop-icons | Crop library |
| Curtis native | proprietary house style | `catalog-assets.ts` | (always) |

PlanZV + Osmic + Temaki symbols include `default_width_m` for drafting size assist and keywords `ai cad` / `design library` where applicable.

## Import / regenerate

```bash
pnpm --filter @workstream/domain import:ai-cad-design
# or individually:
pnpm --filter @workstream/domain import:planzv
pnpm --filter @workstream/domain import:osmic-landscape
pnpm --filter @workstream/domain import:temaki-plants
pnpm --filter @workstream/domain import:temaki-site
pnpm --filter @workstream/domain import:wikimedia-trees
```

Generated files:

- `packages/domain/src/planzv-design-symbols.ts`
- `packages/domain/src/osmic-landscape-symbols.ts`
- `packages/domain/src/temaki-plant-symbols.ts`
- `packages/domain/src/temaki-site-symbols.ts`
- `packages/domain/src/wikimedia-tree-symbols.ts`
- SVGs: `packages/domain/assets/planzv-fnp/`, `temaki-plants/`, `temaki-site/`, `wikimedia-trees/`

Then rebuild domain: `pnpm --filter @workstream/domain build`.
