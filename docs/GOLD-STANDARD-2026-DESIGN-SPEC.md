# Gold Standard 2026 — Canvas Design Specification (as built)

**Status:** Authoritative design specification for the operator canvas, rebuilt
2026-08-24 from the live tokens (`apps/web/src/styles/color-tokens.css`,
`globals.css`, `components/canvas/cfz.ts`) and the verified-as-shipped UI —
not from intent or memory.

**Binding hierarchy:** `GOLD-STANDARD-2026.md` remains SUPREME (architecture
law), with `GOLD-STANDARD-2026-TOKENS.md` (palette) and
`GOLD-STANDARD-2026-ARCHITECTURE.md` (scene graph) beside it. This doc
consolidates their design consequences into one working specification and
records as-built verification, the overrides register, and the design-debt
register. Where this doc and the token files disagree, **the token files win**
— update this doc, never the reverse.

---

## 1. Purpose statement

A professional landscape operator's drafting surface. One WebGL paper plane
carries survey → sketch → CAD → elevation → quote → present → share → garden;
every piece of chrome is glass floating over the drawing. The drawing is the
product; the interface is a set of instruments laid on the desk.

## 2. Aesthetic direction

**Industrial/utilitarian — a technical drawing office.** Neutral paper,
precision ink, instrument-like chrome, one signal color. Depth from light and
neutral shadow tiers, never from color. Status is communicated with ink and
iconography; color is reserved for the critical. (Not "modern/clean/simple":
a drafting instrument.)

## 3. Color system

All values from `styles/color-tokens.css` (CI parity-checked against
`colorTokens.ts` and `packages/ui/tokens.ts`). Contrast ratios are the file's
own annotations.

### 3.1 Surfaces & glass

| Token | Value | Role |
|---|---|---|
| `--gs-canvas` | `#F4F4F4` | Canvas base — WebGL clear color / drafting paper |
| `--gs-panel` / `--gs-panel-grad` | `#FFFFFF` / 180° `#FFF→#FAFAFA` | Floating panel body (Paper Card) |
| `--gs-panel-frost` | 86% white | HUD chrome frost (+ backdrop blur) |
| `--gs-glass-strong` / `--gs-glass-sunken` | `#FAFAFA` / `#EBEBEB` | Elevated step / inset wells |
| `--gs-shadow-1..4` | neutral `rgb(17 17 17 /…)` tiers | 1 hairline → 4 large float; no colored shadows |

### 3.2 Ink & lines

| Token | Value | Contrast on panel | Role |
|---|---|---|---|
| `--gs-ink` | `#1A1A1A` | 17.41:1 | Primary text |
| `--gs-ink-strong` | `#111111` | — | Emphasis, headings, figures |
| `--gs-ink-secondary` | `#525252` | 7.82:1 | Labels, secondary text |
| `--gs-ink-muted` | `#636363` | ≥4.72:1 every surface | The ONE muted value |
| `--gs-line` / `-soft` / `-strong` | `#D4D4D4` / `#E4E4E4` / `#8C8C8C` | 3.36:1 (strong) | Decorative hairline / whisper divider / interactive boundary |

### 3.3 The one accent — Signal Blue

| Token | Value | Use |
|---|---|---|
| `--gs-primary` | `#3D5AFE` | CTA fill, focus ring, active/verified (white-on-it 5.14:1) |
| `--gs-primary-hover` / `-pressed` | `#4D6BFE` / `#2946C8` | Interaction states (4.32:1 / 7.47:1 white-on-it) |
| `--gs-primary-ink` | `#2340C8` | **Blue as text** on paper/washes (7.97:1) |
| `--gs-primary-quiet` / `-veil` | `#D9E0FC` / 8% mix | Resting borders / soft wash |

**Discipline (law):** Signal Blue is the single positive color. Accent =
CTA/active/verified only. Never two competing accents on one surface; never
blue for body-size text except via `--gs-primary-ink`.

### 3.4 Conflict — crimson

`--gs-conflict` `#C41E1E` (text form `#B91C1C`, veil 16%). Conflict / strike
/ critical only — **never a CTA**, and never decorative. `--gs-success` is
deliberately `#525252`: status is ink + iconography, color reserved for the
critical.

### 3.5 Materials (3D, not chrome)

PBR albedo tokens (`--gs-concrete #8C9294`, `--soil-l-500 #8B6F4E`,
`--gs-cad-reclaimed #8E6BB0` muted lilac for subsurface schematics,
`--gs-sky-cool`, `--gs-ground-bounce`) live outside the UI accent system —
they color scene materials, not chrome, and are exempt from the chrome accent
discipline. See overrides register (§11) for the lilac note.

## 4. Typography

| Voice | Token | Face | Role |
|---|---|---|---|
| Technical / numeric | `--font-tech` (= `--font-display`, `--font-mono`) | **Space Grotesk** | Figures, readouts, uppercase labels, kickers |
| UI body | `--font-body` (= `--font-ui`) | **Inter** | Interface copy, sentences |
| Operator ink | `--font-hand` | **Architects Daughter** | Hand-annotations on the drawing |
| Client editorial | `--font-editorial` *(pending — see debt D6)* | Fraunces (intended) | Client-deck composition |

All monospace faces retired (aliases resolve to Space Grotesk). Scale
(`--gs-font-*`): 9.5 micro · 10.5 xs · 11 sm · 11.5 md · 12 lg · 13 sub ·
14 h3 · 16 h2 · 20 h1 — px-locked, no responsive scaling.

## 5. Spatial system

**Spacing ladder** (`--gs-space-*`): 2 · 4 · 6 · 8 · 12 · 16 — plus the known
`--gs-space-10: 10px` wart (non-monotonic; debt D7).

**Z ladder** (`cfz.ts`, four slots only): canvas 0 → spatial 10 → chrome 20 →
app 30. Chrome sub-budgets (rail, strip, dock) live inside the chrome slot;
`webgl-chrome-collision.spec.ts` enforces no overlaps at 2560×1080, 1280×720,
960×640 across four states.

**Layout anatomy (as built):**
- **Left tool rail** — 42px pills, glyph 13px, vertical; marquee and mode
  tools gate on armed state (pan law preserved when unarmed).
- **Right dock** — a single flex column, right-aligned, `gap --gs-space-3`,
  internally scrolling (`maxHeight calc(100dvh - 168px)`). Mode panel
  (`perimeter-panel`, `role="dialog"`, `wsPanelIn`) stacks first; the
  Estimator is a **flow child after it** — structurally unable to paint over
  it — defaulting to the compact running-estimate row alongside tall mode
  panels (survey/sketch/cad/garden), expanded on demand.
- **Perimeter chips** — mode strip + progress pill top-center; dimension HUD
  on the boundary.
- **The canvas is the surface** — chrome floats with air on every side (glass
  capsule, not a dashboard column).

**Responsive:** one studio breakpoint today (≤1100px compact HUD); tablet
tier is debt D4. Mobile-web carries safe-area insets, 44/48px coarse-pointer
targets, 16px input font.

## 6. Component recipes

**Paper Card** (`data-gs-glass-card`): `--gs-panel-grad` body, `--gs-radius-panel`
12px, 1px `--gs-line` 55% border, `--gs-shadow-2` (chrome scale), frost+blur
when HUD, `wsPanelIn 160ms` entrance, internal thin scroll, `maxHeight
min(420px, calc(100dvh - 240px))` when docked.

**Estimator companion** (`estimator-panel`): stage-aware title (Estimator →
Quote after signoff), status word (Provisional/Committed) **survives the
collapsed state**; compact row = `STATUS · N items` over total (Space
Grotesk), real `<button>` with honest aria-label; item count runs through
`dedupeEstimateLines`.

**Status vocabulary:** ink + iconography (✓ marks, glyphs), three ink tiers
+ one blue — see overrides §11 for the icon policy.

## 7. Iconography policy

Typographic drafting notation (✓ ✕ × →) is the studio dialect and permitted.
Two dingbat characters currently doing icon work — `⚠` (DrainageFlowCard) and
`☼` (NibPalette) — are the only chrome glyphs outside that dialect;
direction: replace with ink-colored stroke icons (1.25px stroke, Lucide/
Heroicons family) in the next polish pass. No emoji as icons, ever.

## 8. Motion doctrine

One orchestrated moment (viewport/camera transitions with spring physics),
micro-entrances (`wsPanelIn`) for panels, nothing decorative. Camera springs
snap under `prefers-reduced-motion`; global animation kill-switch in
`globals.css`; kit-scoped guard. Verified in audit 2026-08-24.

## 9. As-built verification record (2026-08-24)

| What | Proof |
|---|---|
| No chrome overlaps, 4 states × 3 viewports (2560×1080/1280×720/960×640), estimator visible | `webgl-chrome-collision.spec.ts` — **passed** (12.1m run) |
| All visible WebGL chrome text ≥ AA | `webgl-contrast-aa.spec.ts` — **passed** |
| Rail pills hold 42px, labels never wrap | collision spec test 3 — **passed** |
| Survey panel state A/B, trees→Assets wiring, estimator coexistence | code-verified 2026-08-24 (this session) |
| Keyed title search (address→parcel, no pin) | live WFS proof + `vicmap-title-search.live.test.ts` |

## 10. Change protocol

Tokens are code (`color-tokens.css` / `colorTokens.ts` / `packages/ui/tokens.ts`,
CI parity-gated; hex allowlist for handoff modules). This doc mirrors them.
Change flow: edit tokens → CI parity/contrast/collision gates → update this
doc in the same PR. Raw hex in components is forbidden — tokens only.

## 11. Overrides register (external-skill conflicts, documented)

Reviewed 2026-08-24 against the ui-design skill methodology (§5 brand-override
clause):

| Skill default | Canvas reality | Disposition |
|---|---|---|
| Inter forbidden | Inter is the mandated UI body voice | **Override** — GS2026 binds it |
| Space Grotesk flagged as convergence risk | Mandated technical voice | **Override** — paired with hand-ink voice; not convergence |
| Blue/purple caution | `#3D5AFE` single accent | **Override** — discipline is stricter than the skill's (CTA-only) |
| Purple-family prohibition | `--gs-cad-reclaimed #8E6BB0` lilac | **Scoped exemption** — 3D material, not chrome; documented here |
| Icon libraries required | Typographic drafting glyphs | **Dialect** — except `⚠`/`☼` (§7, replacement scheduled) |
| Asymmetric layout required | Structural asymmetry (rail/dock/plane) | **Passes** — exceeds bar |

## 12. Design-debt register (status after the 2026-08-24 implementation pass)

- **D1 — Portal ink chain — RESOLVED** (shipped 2026-08-24 pre-pass):
  `--portal-ink-inverted` re-pointed to `--gs-ink`; `.brand` carries charcoal
  with the explanatory comment; remaining whites are legitimate
  white-on-charcoal accept panels.
- **D2 — Home planner — RESOLVED** (2026-08-24): duplicate `.planner` grid
  block (48px Signal-Blue gradient, 1px hairline, dark-era rgba shadows)
  deleted — one flex rule remains; dead widget-accent `::before` system
  removed (live border variant kept); status = ink + iconography (✓ complete,
  ▲ review, hollow/filled dot draft/active); cost figures moved to
  `--gs-ink-strong` (blue re-reserved for CTA).
- **D3 — Focus rings — RESOLVED** (shipped 2026-08-24 pre-pass): icon
  buttons/ticks use enumerated resets, not `all: "unset"`; Button.test pins
  the new contract (asserts NOT all:unset).
- **D4 — Tablet tier — RESOLVED (first increment)** (2026-08-24): below
  1100px the dock narrows to `min(300px, calc(100vw - 140px))` and is
  collapsible — "Panels ▸" collapses the column to a "◂ Panels" reopen pill,
  reclaiming the full drawing. Dock defaults open (spec-visible states
  unchanged). Full overlay-sheet treatment remains future polish.
- **D5 — Fraunces — RESOLVED** (2026-08-24): Fraunces loads once under
  `--font-editorial` (was double-loaded into `--font-display`/`--font-serif`
  which globals re-pointed — it could never render). Editorial consumers:
  quote `.brand`/`.address`, deposit `.brand`/`.heading`, share client card.
  Numerals stay Space Grotesk (money is technical).
- **D6 — folded into D5.**
- **D7 — RESOLVED** (2026-08-24): `--gs-space-10` renamed `--gs-space-5`
  (ladder law: rung N = N×2px; 5×2=10) — token, 3 consumers, migrate-script
  map, standards doc swept.
- **D8 — RESOLVED** (2026-08-24): identity pill, guidance strip, and
  MetaChipSet detail card flipped to paper glass (`--gs-glass-veil` +
  `--gs-blur` + line-mix border + charcoal ink tiers). Dark glass remains
  only in the presentation lens (`ViewportTransitionHUD` dark variant).
- **D9 — RESOLVED** (2026-08-24): plan-view DOM vignette scaled 1.0 → 0.25
  (3D reinforcement stays 0.3) — the paper plane stays paper.

---

*Rebuilt from live code 2026-08-24. Supersedes no supreme doc; consolidates
their design consequences and this week's verification evidence.*
