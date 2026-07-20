# Material design Foley

Quiet CC0 interaction bites when placing or painting studio concepts —
tiny Age-of-Empires-style cues, dialled down for a design / corporate product.

## Families

| Cue | Sounds like | Types |
|-----|-------------|-------|
| Wood | Plank knock / timber hit | deck, hedge |
| Stone / brick | Paver tap, light brick clack | paving |
| Soil | Spade / dig bite | lawn, bed, frenchdrain |
| Softscape | Soft grass / leaf | canopy, feature, exist |

## Sources

See `apps/web/public/sfx/materials/ATTRIBUTION.md` — Kenney Impact Sounds + rubberduck wood/metal (both CC0).

## Behaviour

- `playMaterialFoley(type)` from `materialFoley.ts`
- Respects `prefers-reduced-motion` (silent)
- Peak gain ~0.16; random sample + slight pitch variance
- Synthesized band-pass fallback if a sample fails to decode
