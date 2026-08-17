# Gold Standard 2026 — Token & Typography Spec

> **Subordinate to [`GOLD-STANDARD-2026.md`](./GOLD-STANDARD-2026.md).**
> This is the binding color and font specification. Every visual value in the
> operator canvas, chrome, and mobile surface must resolve to a token defined
> here. Raw `#hex` / `rgba` literals in handoff modules are CI-gated
> (`scripts/check-handoff-chrome-colors.mjs`) — the gate's allowlist is the
> `--gs-*` namespace defined below. The TS mirror (`colorTokens.ts`) is pinned
> to this file by `colorTokens-css-sync.test.ts`.

---

## 1. Studio Paper palette

The single theme (2026 pivot). The canvas is high-key drafting paper so the
drawing — landscape content, water gradients, CAD lines — is the most
saturated thing on screen. The old Studio Dark default is retired: a dark
canvas swallowed design content and forced every signal colour through
lifted-stop patches. Depth now comes from light: gradient-lit panels, frost,
and neutral shadow tiers. Never darkness.

### 1.1 Surface tokens (dead-neutral — R=G=B, zero undertones)

| Token | Value | Role |
|-------|-------|------|
| `--gs-panel` | `#FFFFFF` | Floating panel body (gradient via `--gs-panel-grad`) |
| `--gs-canvas` | `#F4F4F4` | Canvas base — the WebGL clear color / drafting paper |
| `--gs-glass-strong` | `#FAFAFA` | Elevated step / hovered panel fill |
| `--gs-glass-sunken` | `#EBEBEB` | Inset wells inside panels |
| `--gs-surface-fill` | `#FAFAFA` | Subtle fills inside white panels |
| `--gs-sunken` | `#EBEBEB` | Hover fills |
| `--gs-pressed` | `#E4E4E4` | Pressed fills |
| `--gs-frame` | `#E4E4E4` | Gallery frame |
| `--gs-line` | `#D4D4D4` | Decorative hairline only (non-semantic) |
| `--gs-line-strong` | `#8C8C8C` | Interactive boundaries (3.36:1 on panel) |
| `--gs-disabled` | `#A3A3A3` | Disabled text/glyphs (AA-exempt) |

### 1.2 Semantic signal tokens — Signal Blue is the sole UI accent; crimson is conflict-only

Reserved exclusively for: primary CTA, active tool state, focus rings.
Crimson is demoted to **conflict/strike only** (the 2026-08-17 DeepSeek-blue
accent pivot): utility and root zone collisions, critical warnings — never
primary CTA. Gold is retired from chrome (the murky dim gold `#9c7416` and
the gold/warning amber collision are dead). Cobalt survives as **drawing data
only** — where `#0030CF` finally works (8.2:1 on paper; it was 2:1 on the
dark canvas and failed SC 1.4.11).

| Token | Value | Role |
|-------|-------|------|
| `--gs-primary` | `#3D5AFE` | **Signal Blue base** — CTA fill, focus ring (white-on-it 5.14:1) |
| `--gs-primary-hover` | `#4D6BFE` | Blue hover — DeepSeek brand blue (white-on-it 4.32:1) |
| `--gs-primary-pressed` | `#2946C8` | Blue pressed (white-on-it 7.47:1) |
| `--gs-primary-ink` | `#2340C8` | Blue as text on paper (7.97:1) |
| `--gs-primary-quiet` | `#D9E0FC` | Resting blue borders / veil endpoint |
| `--gs-truth` | `#0030CF` | **Cobalt data stroke** — proposed geometry, easements, title (8.22:1 on canvas) |
| `--gs-truth-soft` | `#2450C7` | Cobalt hover/secondary |
| `--gs-truth-ink` | `#2450C7` | Cobalt label text on paper (6.89:1) |
| `--gs-conflict` | `#C41E1E` | **Strike Alert crimson** — conflict/strike only since the blue pivot |
| `--gs-conflict-soft` | `#B91C1C` | Strike text on paper (AA) |
| `--gs-success` | `#525252` | Status is ink + iconography; colour reserved for critical |
| `--gs-warning` | `#525252` | Status is ink + iconography; colour reserved for critical |

### 1.3 Ink tokens — the charcoal hierarchy

| Token | Value | Role |
|-------|-------|------|
| `--gs-ink` | `#1A1A1A` | Primary text (17.41:1 on panel) |
| `--gs-ink-strong` | `#111111` | Emphasis, headings, figures |
| `--gs-ink-secondary` | `#525252` | Secondary text, labels (7.82:1) |
| `--gs-ink-muted` | `#636363` | ONE muted value — ≥4.72:1 on every surface incl. pressed |
| `--gs-ink-truth` | `var(--gs-ink)` | Primary text — the doc name components reference (bug heal: once referenced, never defined) |
| `--gs-ink-primary` | `var(--gs-ink-strong)` | Emphasis ink — was gold, now charcoal |
| `--gs-ink-conflict` | `#B91C1C` | Critical/strike label ink |

**Selection vocabulary:** `--gs-chip-active: #1A1A1A` / `--gs-chip-active-ink:
#FFFFFF` (15.83:1). Active tools, selected modes, and "you are here" states
are charcoal-filled chips — NOT accent-hued. The accent stays rare so it
stays sharp.

### 1.4 Panel depth law (replaces the glass density law)

Panels are ONE frosted layer floating above the drawing, lifted by light:

```css
.panel {
  background: var(--gs-panel-grad);   /* linear-gradient(180deg, #FFFFFF, #FAFAFA) */
  /* floating HUD variant: */
  /* background: var(--gs-panel-frost);  86% white + backdrop-blur */
  backdrop-filter: blur(var(--gs-frost-blur));   /* 12px */
  border-radius: var(--gs-radius-panel);         /* 12px */
  border: 1px solid color-mix(in srgb, var(--gs-line) 55%, transparent);
  box-shadow: var(--gs-shadow-2);
}
```

Depth tokens (defined once in `styles/color-tokens.css`):
`--gs-panel-grad`, `--gs-panel-frost` (86%), `--gs-frost-blur` (12px),
`--gs-shadow-1..4` (neutral `rgb(17 17 17 / …)` tiers: chip → panel →
popover → command palette), `--gs-radius-panel` (12px),
`--gs-radius-chip` (6px), `--gs-radius-pill` (999px).

**No heavy borders.** Hairlines are decorative; anything a user must identify
by edge uses `--gs-line-strong`. Status is communicated with ink weight +
iconography, never with extra hue.

**Chrome type floor (unchanged amendment, 2026-08-15): 10.5px labels / 11px
figures**; glyph accents may floor at 9.5px.

### 1.5 APWA utility locate colors (mode-invariant, retained)

These are retained from the pre-Gold-Standard token system because they are
the industry-standard utility color code — they must not change.

| Token | Value | Utility |
|-------|-------|---------|
| `--apwa-water` | `#1e88c7` | Water |
| `--apwa-sewer` | `#2f8f4e` | Sewer |
| `--apwa-gas` | `#e8b000` | Gas |
| `--apwa-electric` | `#d63b2f` | Electric |
| `--apwa-comms` | `#e8722f` | Communications |
| `--apwa-reclaimed` | `#8b4fc7` | Reclaimed water |

### 1.6 Planting + material families (retained)

The planting palette (`--forest-*`, `--sprout-*`, `--sage-*`, `--hedge-*`,
`--olive-*`) and material palette (`--soil-*`, `--mulch-*`, `--bluestone-*`,
`--concrete-*`, `--timber-*`, `--water-*`, `--gravel-*`, `--lawn-*`) are
retained. They describe real-world material colors, not chrome. Earthworks
cut/fill rides `--gs-earthworks-cut` (crimson) / `--gs-earthworks-fill`
(`#C9A84C` muted drafting gold) — a data pair, never the UI accent.

---

## 2. Typography

### 2.1 Font roles

| Role | Font | CSS variable | Weights | Used for |
|------|------|-------------|---------|----------|
| Technical | **Space Grotesk** | `--font-tech` | 400–700 | Coordinates, dimensions, GPM, pressure, RLs, all numeric/technical data |
| UI | **Inter** | `--font-ui` | 400–700 | All chrome labels, buttons, inputs, mode tabs, HUD text |
| Display | **Fraunces** | `--font-display` | 400–700 | Presentation Lens / client deck composition only |
| Annotation | **Architects Daughter** | `--font-hand` | 400 | Hand-lettered plan annotations only |

### 2.2 Retired fonts

- **Sora** — was UI chrome font. Retired; replaced by Inter.
- **IBM Plex Sans** — was body font. Retired; replaced by Inter for UI, Space Grotesk for technical.
- **IBM Plex Mono** — was meta/CAD mono font. Retired; replaced by Space Grotesk for technical/numeric.
- **IBM Plex Serif** — was present-deck serif. Retired; Fraunces covers display.

### 2.3 Loading

All fonts load via `next/font/google` in `apps/web/src/app/layout.tsx` with
`display: "swap"` and CSS variables. No external `<link>` stylesheets.

---

## 3. Migration mapping (Studio Dark → Studio Paper, 2026)

| Old token (Dark) | New token (Paper) | Note |
|-----------|----------|------|
| `--gs-canvas` (`#101418`) | `--gs-canvas` (`#F4F4F4`) | Canvas flips dark → paper; WebGL clear follows |
| `--gs-glass` (`#1E2329`) | `--gs-panel` (`#FFFFFF`) | Solid white panels; frost variant for HUD |
| `--gs-glass-veil` (38% dark) | `--gs-panel-frost` (86% white) | One translucent layer, same law |
| `--gs-primary` (`#fbbf24` gold) | `--gs-primary` (`#3D5AFE` blue) | Gold retired from chrome; murky `#9c7416` deleted. The paper pivot briefly used crimson as primary; the 2026-08-17 DeepSeek pivot moved primary to Signal Blue with crimson demoted to conflict-only |
| `--gs-truth` (`#0030CF`, 2:1 on dark) | `--gs-truth` (`#0030CF`) | Same hex — now 8.2:1 on paper; data-only |
| `--gs-truth-ink` (`#6B8EEA`) | `--gs-truth-ink` (`#2450C7`) | Dark-era lifted stop retired |
| `--gs-conflict` (`#ef4444`) | `--gs-conflict` (`#C41E1E`) | Unified with primary crimson |
| `--gs-ink` (`#E8E9EC`) | `--gs-ink` (`#1A1A1A`) | Charcoal hierarchy |
| `--gs-ink-muted` (3 competing values) | `--gs-ink-muted` (`#636363`) | ONE value, AA on every surface |
| `--gs-ink-truth` (referenced, never defined) | `--gs-ink-truth` = `--gs-ink` | Bug heal; defined for the first time |
| `--gs-success` / `--gs-warning` (green/amber) | `#525252` ink | Status = ink + iconography |
| `.rootDark` (handoff SVG) | no-op alias of `.root` | Single theme |

---

## 4. Contrast

All text must meet **WCAG 2.2 AA** (4.5:1 body, 3:1 large; 3:1 non-text for
boundaries/geometry). Gates: `e2e/canvas-contrast-aa.spec.ts`,
`e2e/webgl-contrast-aa.spec.ts`, and the vitest math in
`apps/web/src/styles/colorTokens.test.ts`.

Verified pairs (relative-luminance math, panel `#FFFFFF` / canvas `#F4F4F4` /
sunken `#EBEBEB` / pressed `#E4E4E4`):

- `--gs-ink` (`#1A1A1A`): **17.41 / 15.83 / 14.61 / 13.80** ✅ AAA
- `--gs-ink-secondary` (`#525252`): **7.82 / 7.11 / 6.56 / 6.15** ✅
- `--gs-ink-muted` (`#636363`): **6.00 / 5.46 / 5.04 / 4.72** ✅ on every surface
- white on `--gs-chip-active` (`#1A1A1A`): **15.83** ✅
- white on `--gs-primary` (`#3D5AFE`): **5.14**; hover `#4D6BFE`: **4.32** (large text / 3:1 UI only); pressed `#2946C8`: **7.47** ✅
- `--gs-primary-ink` (`#2340C8`) as text on panel: **7.97** ✅
- white on `--gs-conflict` (`#C41E1E`): **5.91** ✅ (conflict/strike only since the blue pivot)
- `--gs-truth` (`#0030CF`) stroke on canvas: **8.22** ✅ (was 2.1 on dark — the pivot fixes Signal Blue)
- `--gs-truth-ink` (`#2450C7`) on panel: **6.89** ✅
- `--gs-line-strong` (`#8C8C8C`) boundary on panel: **3.36** ✅ non-text
