# Auto trench — landscape construction routing

**Audience:** Curtis & Co operators planning dig paths for irrigation,
lighting conduit, and drainage on the handoff board.  
**Not:** BYDA / authority asset locations (sewer, gas, NBN, water main).

## What it does

Cmd+K → **Auto trench…** proposes construction trenches from authored geometry:

| Kind | Source | Indicative depth |
| --- | --- | --- |
| Irrigation main | House-side manifold → drip zone starts | 400 mm |
| Irrigation lateral | Under drip zone polylines | 250 mm |
| Lighting conduit | Along lighting zone runs | 300 mm |
| Drainage | Chains `frenchdrain` symbols → south boundary cue | 450 mm |

Paths nudge out of easement rings, closed survey corridors, and TPZ discs when
possible. Proposals are **ghosts** until Accept; only accepted runs persist on
`DesignCanvas.construction_trenches` and feed live BOM excavate lm.

## Operator rules

1. Draw drip / lighting zones (and place french drains) first.  
2. Run Auto trench → review dashed proposals → Accept or Reject.  
3. **BYDA before excavation** — auto trench is a landscape dig plan, not DBYD.  
4. Survey Servc / Vicmap easements remain site context; trenches are build scope.  
5. Use the **Services ledger** to focus lighting runs + power/easement corridors before routing conduit.  
6. Full LA pack (KEYLESS / BYDA / council): `docs/SITE-INFRASTRUCTURE-AUTOMATED-LINKS.md`.

## Code map

- Domain: `packages/domain/src/auto-trench.ts` (`proposeAutoTrenches`)  
- Contracts: `ConstructionTrenchSchema` on `DesignCanvas.construction_trenches`  
- Studio: `useStudioState.runAutoTrench` + `TrenchOverlay`  
- Persist: `saveDesignCanvasAction` (ghosts stripped)
