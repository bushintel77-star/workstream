# Open Crop Icons (not shipped)

**Status: removed from the build 2026-08-21.** Regeneratable, not exported.
Licence record: [`ASSET-LICENCES.md`](./ASSET-LICENCES.md).

**[Open Crop Icons](https://github.com/openfarmcc/open-crop-icons)** (CC0-1.0)
was imported as 247 `opencrop-{slug}` planting symbols. It never reached a
user:

- it was never merged into `CURTIS_CATALOG_SYMBOLS` (`catalog.ts`), so
  `listCatalogSymbols` never served it;
- `isSketchGoldStandard` rejects the `opencrop-` prefix, so the sketch library
  and its search excluded it by contract;
- no UI rendered it, and the "Open crop library" filter chip this doc used to
  describe does not exist.

It was still costing bundle. `@workstream/domain` compiles to CommonJS with no
`sideEffects: false`, so a CJS re-export getter cannot be tree-shaken: the
`OPEN_CROP_SYMBOLS` export in `packages/domain/src/index.ts` pulled the whole
~1.5 MB `open-crop-symbols.js` into a production chunk. An audit found
`opencrop-acorn-squash` inside a shipped 2.67 MB chunk.

Removed: the generated `packages/domain/src/open-crop-symbols.ts` and its
`index.ts` export. **Kept:** the generator
(`scripts/generate-open-crop-catalog.mjs`), the `import:open-crop` script, the
`open-crop-icons` devDependency, and the `opencrop-` rejection in
`isSketchGoldStandard` — so the pack is one command away and cannot re-enter
the gold library silently.

## Regenerate

```bash
pnpm install   # ensures devDependency open-crop-icons is present
pnpm --filter @workstream/domain import:open-crop
```

That writes `packages/domain/src/open-crop-symbols.ts` back. Re-exporting it
from `index.ts` will put ~1.5 MB back into the client bundle unless the
CommonJS→ESM / `sideEffects` question is solved first.
