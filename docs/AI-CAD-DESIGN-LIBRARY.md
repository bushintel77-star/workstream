# AI CAD design library (open source)

Quality open-source symbols for site design on the one-canvas studio / AI CAD path.

| Pack | Licence | Source | Filter chip |
|------|---------|--------|-------------|
| **PlanZV FNP** | CC0 | [geoObserver/PlanZV-FNP](https://github.com/geoObserver/PlanZV-FNP) | **AI CAD design** |
| **Osmic landscape** | CC0 | [gmgeo/osmic](https://github.com/gmgeo/osmic) | Landscape library / AI CAD design |
| **Wikimedia trees** | CC BY-SA 4.0 | Heinrich Böll Foundation set | Tree pack |
| **Open Crop** | CC0 | openfarmcc/open-crop-icons | Crop library |
| Curtis native | proprietary house style | `catalog-assets.ts` | (always) |

PlanZV + Osmic symbols include `default_width_m` for drafting size assist and keywords `ai cad` / `design library`.

## Import / regenerate

```bash
pnpm --filter @workstream/domain import:ai-cad-design
# or individually:
pnpm --filter @workstream/domain import:planzv
pnpm --filter @workstream/domain import:osmic-landscape
```

Generated files:

- `packages/domain/src/planzv-design-symbols.ts`
- `packages/domain/src/osmic-landscape-symbols.ts`
- SVGs: `packages/domain/assets/planzv-fnp/`

Then rebuild domain: `pnpm --filter @workstream/domain build`.
