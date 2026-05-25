# Wikimedia tree pack

Thirteen landscape tree silhouettes from Wikimedia Commons **[Set of trees](https://commons.wikimedia.org/wiki/Category:SVG_trees)** (Heinrich Böll Foundation, **CC BY-SA 4.0**). Attribution is required when you redistribute or publish outputs that include these glyphs.

- **IDs:** `wikimedia-tree-01` … `wikimedia-tree-13`
- **Category:** `planting`
- **Filter in studio:** Place → **All** or **Planting** → **Tree pack**
- **Generated file:** `packages/domain/src/wikimedia-tree-symbols.ts`
- **Source SVGs:** `packages/domain/assets/wikimedia-trees/tree-NN.svg`

## Attribution (include in client-facing credits where applicable)

> Tree silhouettes from the Heinrich Böll Foundation “Set of trees” (CC BY-SA 4.0), via [Wikimedia Commons](https://commons.wikimedia.org/wiki/Category:SVG_trees).

Programmatic constant: `WIKIMEDIA_TREE_ATTRIBUTION` from `@workstream/domain`.

## Regenerate

```bash
pnpm --filter @workstream/domain import:wikimedia-trees
```

Downloads use the Commons API (respect rate limits). The generator simplifies traced paths for studio preview size; originals stay in `assets/wikimedia-trees/` for re-import.

Curtis-native symbols remain in `catalog-assets.ts`. Osmic site furniture is under **Landscape library**. Open Crop Icons stay under **Crop library**.
