# Screenshot audit — 12 Wrights Terrace Cad draft (2026-07-19)

Issues noted from production Cad screenshot and fixes shipped.

| # | Issue | Severity | Fix |
|---|--------|----------|-----|
| 1 | Header Vicmap truth vs canvas “ghost cadastral” | P0 | Vicmap hydrate sets `boundarySource`; cue → “Vicmap title” |
| 2 | Dashed ghost title stroke while Vicmap known | P0 | Solid charcoal when `titleLocked` / Vicmap |
| 3 | Dual soft + plan cadastral underlay | P0 | Soft underlay skipped when Vicmap locked |
| 4 | Auto AI spawn on Cad open (~11 proposals) | P0 | Removed mount `scanGhosts`; canopy scan opt-in only |
| 5 | Aerial colour blobs + forced Coach/Review | P0 | `autoCanopyScan=false`; quiet canopy ingest |
| 6 | AI DRAFT + SAVED epistemic confusion | P1 | Chip → “VICMAP TITLE · DESIGN DRAFT” when Vicmap + unverified |
| 7 | Cad chrome stack (Sun/Council/Isolith/AI) | P1 | Chrome diet while `pendingGhosts > 0` |
| 8 | Council ticker “1.5 m setback” as measured | P1 | Label → “1.5 m rule” |
| 9 | Auto-forced setback/TPZ overlays | P1 | Removed auto `setbackOn` effect |
| 10 | Stage 1 mode not locked to Survey | P1 | `setMode` no-op + tabs disabled |
| 11 | Exit Stage 1 re-arms aerial/canopy | P1 | `aerialSuppressed` blocks re-injection |
| 12 | Free zoom during Stage 1 | P1 | Zoom no-op; Fit snaps 1:100 |
| 13 | Double north (ground + plan) | P2 | Plan `N↑` hidden when title locked |
| 14 | Stage 1 access buried | P1 | Header **Stage 1** button (prior) |

**Operator path for clean foundation:** click **Stage 1** (or ⌘K → Stage 1 foundation cleanse).
