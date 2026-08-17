# Plant palette — provenance & sourcing

`plant-palette.json` is the **species database seed** for the auto plant-schedule
generator (`buildPlantingSchedule`). It is a curated, Melbourne-appropriate
subset — not a claim of exhaustive coverage.

## Open-source sources

- **[VicFlora](https://vicflora.rbg.vic.gov.au/) — Royal Botanic Gardens
  Victoria** (open botanical data): taxonomy (species / cultivar names),
  growth form, native status, and Victorian distribution. The `native` flags
  and botanical names follow APC (Australian Plant Census) usage.
- **[Australian Plant Census (APC)](https://biodiversity.org.au/nsl/services/search/taxonomy)**:
  accepted botanical names and synonymy for the Australian-native entries.
- **Victorian nursery practice** (standard trade data): pot sizes, on-centre
  spacing, sun/water/growth bands, flowering season and frost hardiness are
  written from common nursery catalogues and landscape-specification practice
  for the Melbourne (temperate, dry-summer) context.

## Honesty rule

The palette is a **seed** for design-time estimation. Spacing, pot size and
water bands are indicative trade values — the schedule generator labels its
output `Indicative planting schedule … confirm pot size and spacing on site /
with nursery`, and the same honesty carries into the generated CSV.

## Regeneration

`scripts/enrich-plant-palette.ts` is the one-off enrichment used to add the
professional fields and expand the library (43 → 53 species, 51 with spacing,
19 native). Future growth should add species with the same field shape and
cite the open source per entry.
