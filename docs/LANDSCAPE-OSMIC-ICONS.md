# Osmic landscaping icons

Site-plan symbols from **[Osmic](https://github.com/gmgeo/osmic)** (CC0): trees, fountains, benches, gates, steps, playground, garden centre, and related items.

- **IDs:** `osmic-{folder}-{name}` (e.g. `osmic-nature-tree-deciduous`)
- **Categories:** `planting`, `water`, `furniture`, `structure`, `paving`, `annotation`
- **Filter in studio:** Planting tab → **Landscape library**
- **Generated file:** `packages/domain/src/osmic-landscape-symbols.ts`

## Regenerate

```bash
pnpm --filter @workstream/domain import:osmic-landscape
```

Curtis-native symbols (hornbeam, Lomandra, bluestone, TRP, etc.) stay in `catalog-assets.ts`. Open Crop Icons remain under **Crop library** for edible crops only.
