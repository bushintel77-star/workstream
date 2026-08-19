# Gold Standard 2026 compliance sweep — 2026-08-19

A source-level enforcement pass against the binding spec
(`docs/GOLD-STANDARD-2026-TOKENS.md` and `docs/GOLD-STANDARD-2026.md`).
Triggered by pixel audits of four current-state captures that showed 52–84%
mid-grey `#909090` dominance: 40% black scrims over the `#F4F4F4` paper
canvas compute to exactly that grey. Every fix below cites the clause it
answers to.

## Violations found and fixed

### 1. Panel depth law — "Never darkness" (TOKENS §1.4, §1 intro)

| Surface | Before | After |
|---|---|---|
| `RailDrawer` scrim (home planner) | `rgba(0, 0, 0, 0.4)` full-page scrim | `color-mix(in srgb, var(--gs-ink-strong) 16%, transparent)` — neutral ink dim, paper stays light |
| `BottomDock` scrim (mobile) | `rgba(0, 0, 0, 0.4)` | same neutral dim |
| Shared `Dialog` scrim (`ui.module.css`) | `color-mix(in srgb, #000 50%, transparent)` + raw `#000` (also a token-law hit) | `color-mix(in srgb, var(--gs-ink-strong) 22%, transparent)` |
| `kit` Sheet scrim | `#000 40%` | ink 18% |
| `DeckInspectorDock` controls | dark-era `black 10%` gradient fills + `#000 30%` inset shadows | `--gs-sunken` well fill + milled `inset 0 1px 1px rgb(255 255 255 / 70%)` highlight (the `--ws-milled-shadow` pattern) |
| `arBirdseye` bottom dock | `--gray-d-100` dark-slate panel at 92% (dark-era sediment) | `--gs-panel` 92% paper panel |

### 2. Neutral shadow tiers (TOKENS §1.4 — `--gs-shadow-1..4`)

All hardcoded heavy black shadows replaced with the neutral
`rgb(17 17 17 / …)` tiers:

| File | Before | After |
|---|---|---|
| `bottom-dock`, `rail-drawer` | `0 -8px 24px rgba(0,0,0,0.4), 0 -16px 48px rgba(0,0,0,0.2)` | `var(--gs-shadow-3)` |
| `ui.module.css` dialog panel | `0 24px 64px rgba(0,0,0,0.4)` | `var(--gs-shadow-4)` |
| `ui.module.css` popover | `0 12px 32px rgba(0,0,0,0.28)` | `var(--gs-shadow-3)` |
| `kit.module.css` tooltip | `0 2px 4px rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.1)` | `var(--gs-shadow-2)` |
| `newProjectAddressForm` suggestions | `0 8px 24px #000 24%` | `var(--gs-shadow-2)` |
| `DeckInspectorDock` | three-layer `#000 24/26/20%` stack | `var(--gs-shadow-3)`; `::before` bottom edge `rgb(0 0 0 / 18%)` → `rgb(17 17 17 / 6%)` |

### 3. Signal Blue is the sole accent — focus rings (TOKENS §1.2)

- `RailDrawer` / `BottomDock` handle focus: `outline: 2px solid var(--info)` (grey `#525252`) → `var(--gs-primary)` (`#3D5AFE`).
- `--tier1-bar-focus-ring` was `var(--ink-tertiary)` (grey) → `var(--gs-primary)`. Every tier-1 control inherits the Signal Blue focus ring.
- `--tier1-bar-line-strong` was `var(--line, var(--surface-overlay))` — `--line` is undefined, so it fell back to `#FAFAFA`, an invisible boundary on a white bar → `var(--gs-line-strong)` (`#8C8C8C`, the spec's 3.36:1 interactive boundary).

### 4. Typography roles — retired fonts removed (TOKENS §2)

- `JetBrains Mono` deleted from `app/layout.tsx` (import, declaration, body
  class). It was a post-spec addition; the spec retires all monos — technical
  and numeric is **Space Grotesk**.
- `--font-mono` and the `--font-technical-mono` compat alias now resolve to
  `var(--font-tech), "Space Grotesk"` in `globals.css`; `goldStandardStudio`
  `--gs-font-tech` re-pointed. All ~60 consumers (tier-1 ledgers, survey
  checklist, elevation sheets, portal, settings, landing, studio HUD) now
  render the spec technical font; 4 hardcoded `"JetBrains Mono"` literals
  replaced with `var(--font-mono)`.

### 5. Token-only colours and frost consistency

- `VignetteOverlay` raw `rgba(17,17,17,0.22)` and dark-era slate glow
  `rgba(30,35,41,0.08)` → `color-mix` against `--gs-ink-strong` / `--gs-shadow`
  (identical neutral values, token-bound).
- Hardcoded frost blurs tokenized to `var(--gs-frost-blur)` (12px):
  `app.module.css` page header/footer (14/16px), `toast-host`, `clientShare`,
  `arBirdseye`, `PhotoTraceHud` (10px), `rail-drawer` (20px).

### 6. Radius tokens (TOKENS §1.4 — panel 12px / chip 6px / pill 999px)

Shared surfaces moved off the legacy `--r-*` scale onto the spec tokens:
`ui.module.css` dialog panel (was `--r-lg` 10px) and popover menu (was
`--r-sm` 5px) → `--gs-radius-panel`; `newProjectAddressForm` suggestions
dropdown (was `--r-sm`) → `--gs-radius-chip`. The legacy `--r-*` scale
(5/7/10/14/18) itself remains for non-GS surfaces pending a full audit.

### 7. Radius scale — spec-aligned via compat aliases

The legacy `--r-*` scale (5/7/10/14/18/24px) drifted from the three sanctioned
radii (panel 12 / chip 6 / pill 999). Re-pointed the aliases in `globals.css`:
`--r-sm/--r-md` → `--gs-radius-chip` (6), `--r-lg/--r-xl/--r-2xl/--r-3xl/
--r-canvas` → `--gs-radius-panel` (12), `--r-pill` → `--gs-radius-pill`.
All 91 legacy call sites now resolve to sanctioned radii with zero call-site
churn.

### 8. Signal Blue active states + focus (§1.2)

`--info` (grey `#525252`) stays for status/ink roles (info pills, semantic
alias, overlay wash — the "status = ink + iconography" law). Accent and
active roles converted to `--gs-primary`: rail/dock handle accent bars,
processing-stage active border/sheen/pulse halo/spinner, reduced-motion
halo. Weather rain figure → `--ink-secondary`.

### 9. Chrome type floor (TOKENS §1.4 amendment)

72 sub-floor font sizes swept to the floor: labels → 10.5px, figures → 11px
(`--text-xs` already 11), glyph accents → 9.5px. `--text-femto/pico` now hold
the 9.5px glyph floor; `--text-nano/micro` hold the 10.5px label floor.
Zero sub-floor values remain in `apps/web/src`.

### 10. Colour gate now enforces "never darkness"

`scripts/check-handoff-chrome-colors.mjs` extended beyond hex: it now fails
on scrim-strength black overlays — `rgba(0, 0, 0, α ≥ 0.20)` and
`color-mix(…, #000/black ≥ 20%)` outside the render-value allowlist. That is
the exact failure mode the original 40–50% black scrims slipped through on;
it cannot recur. Neutral ink mixes and `--gs-shadow-1..4` remain the lawful
dim/lift.

### 11. Sun chip — real solar geometry (zero-mock)

The meta chip-set's solar chip is now honest: a new domain module
(`solar-window.ts` + tests) computes the unshaded daylight window from
latitude and day-of-year (solar declination → hour angle). The page feeds
it for every project with a latitude; the chip reads "X.Xh Sun Window"
with a detail line stating canopy-adjusted exposure lives in the flora
ring's live model. No fabricated "direct sun" figures.

### 12. Hygiene

- 14 double-encoded mojibake sequences in `styles/globals.css` comments
  (`â\u0080\u0094` → `—`, `Â§` → `§`) fixed byte-exact via Node; repo scanned
  for the `C2 80/94` byte pattern — zero remaining.

## Verification

- Full `pnpm run ci` gate green (same session, commit `12ef51a`):
  typecheck 9/9, lint `--max-warnings 0`, 241 test files green, handoff
  colour gate clean (no new raw hex — the sweep removed several),
  tier-1 spec gap 0 p0, CSS scales ratchet unchanged.
- Contrast: all replacement values are spec-verified pairs; ink scrims over
  paper are neutral dims that keep AA text ratios on the pages they cover
  (scrims sit under panels; panel text is on white, unchanged).

## Known remaining sweep items (next rounds)

- GitLab CI compute is blocked at the account level (every pipeline —
  including a one-job probe — fails instantly with zero jobs; runners are
  online). Human step: validate a payment method under GitLab billing so
  shared-runner compute unlocks, then the `gate`/`scan`/`e2e`/`docker`/
  `deploy` pipeline will run as authored.
- `RAILWAY_TOKEN` (project-scoped, Railway dashboard → Settings → Tokens)
  must be added to GitLab CI/CD variables for the auto-deploy stage to arm;
  it self-disables until then.
- Periodic re-scan of new code for raw radii, sub-floor font sizes, and
  non-`--gs-*` accent hues — the colour gate now covers hex AND black
  scrims.
