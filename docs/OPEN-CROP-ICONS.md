# Open Crop Icons (planting library)

Workstream imports **[Open Crop Icons](https://github.com/openfarmcc/open-crop-icons)** (CC0 / public domain) as studio planting symbols.

- **IDs:** `opencrop-{slug}` (e.g. `opencrop-tomato`)
- **Category:** `planting` — appears in Design Studio asset rail under Planting
- **Filter:** “Open crop library” chip in the planting filters
- **Source file:** `packages/domain/src/open-crop-symbols.ts` (generated)

## Regenerate after updating the icon pack

```bash
pnpm install   # ensures devDependency open-crop-icons is present
pnpm --filter @workstream/domain import:open-crop
```

No API key or runtime fetch — symbols are baked into `@workstream/domain` and served via `listCatalogSymbols`.
