# Gold Standard 2026 — Token & Typography Spec

> **Subordinate to [`GOLD-STANDARD-2026.md`](./GOLD-STANDARD-2026.md).**
> This is the binding color and font specification. Every visual value in the
> operator canvas, chrome, and mobile surface must resolve to a token defined
> here. Raw `#hex` / `rgba` literals in handoff modules are CI-gated
> (`scripts/check-handoff-chrome-colors.mjs`) — the gate's allowlist is the
> `--gs-*` namespace defined below.

---

## 1. Studio Dark palette

The single theme. There is no light/canvas-parchment default — the board is
dark. The old cream-on-dark-gallery-frame system is retired.

### 1.1 Surface tokens

| Token | Value | Role |
|-------|-------|------|
| `--gs-canvas` | `#101418` | Canvas base — the WebGL clear color / ground plane |
| `--gs-glass` | `#1E2329` | Glass Card body (chrome mixes it at 38% — see §1.4) |
| `--gs-glass-strong` | `#252B33` | Glass Card elevated / hovered |
| `--gs-glass-sunken` | `#171B20` | Glass Card inset / pressed |
| `--gs-frame` | `#0C0F12` | Gallery frame border (darker than canvas) |
| `--gs-line` | `#2E343C` | Hairline borders on glass surfaces |
| `--gs-line-soft` | `#23282E` | Subtle dividers |

### 1.2 Semantic signal tokens

| Token | Value | Role |
|-------|-------|------|
| `--gs-primary` | `#fbbf24` | **Gold Standard** — active, compliant, verified, staking chips |
| `--gs-primary-dim` | `#9c7416` | Gold at rest / disabled |
| `--gs-truth` | `#0030CF` | **Signal Blue** — boundaries, (0,0,0) origin peg, easements, title |
| `--gs-truth-soft` | `#1E45E8` | Signal Blue hover/secondary |
| `--gs-conflict` | `#ef4444` | **Strike Alert** — utility collision, root zone violation |
| `--gs-conflict-soft` | `#F87171` | Strike at reduced intensity (pulse halo) |
| `--gs-success` | `#22c55e` | Compliance pass |
| `--gs-warning` | `#f59e0b` | Advisory / non-blocking warning |

### 1.3 Ink tokens (text on glass)

| Token | Value | Role |
|-------|-------|------|
| `--gs-ink` | `#E8E9EC` | Primary text on glass/canvas |
| `--gs-ink-secondary` | `#9AA0AC` | Secondary text, labels |
| `--gs-ink-muted` | `#8B8F96` | Muted meta, captions (AA: ~5.1:1 on glass) |
| `--gs-ink-primary` | `#fbbf24` | Gold ink (numeric highlights) |
| `--gs-ink-truth` | `#6B8EEA` | Signal Blue ink for boundary labels (AA on dark) |
| `--gs-ink-conflict` | `#F87171` | Strike ink for alert labels (AA on dark) |

### 1.4 Glass density — the canvas-first law (updated)

**Canvas-first (2df3f05):** Glass Cards are ONE semi-opaque layer — the drawing
reads through every card, so chrome floats on the canvas instead of paneling
over it. The density recipe is tokenized and binding app-wide (studio HUD,
landing HUDs, operator chrome):

```css
.glass-card {
  background: var(--gs-glass-veil); /* color-mix(in srgb, var(--gs-glass) 38%, transparent) */
  backdrop-filter: blur(var(--gs-blur));         /* 10px */
  border-radius: var(--gs-radius-panel);          /* 12px */
  border: 1px solid color-mix(in srgb, var(--gs-line) 35%, transparent);
}
```

Density tokens (defined once in `styles/color-tokens.css`):
`--gs-glass-veil` (38%), `--gs-glass-veil-strong` (55%), `--gs-blur` (10px),
`--gs-radius-panel` (12px), `--gs-radius-chip` (6px), `--gs-radius-pill` (999px).

The retired 70% / blur-12 / radius-16 recipe applied only during the Phase 0–2
transition and no longer represents the standard. Chrome text uses the meta
chip idiom: Space Grotesk (`--font-tech`) figures, Inter labels,
`--gs-radius-chip` pills.

**Amendment (2026-08-15, operator directive): chrome type floor is 10.5px for
labels and 11px for figures.** The original 9–10px meta-chip figures were
unreadable at operator viewing distance; glyph accents (stock marks, ⤢
hand-off marks) may floor at 9.5px. WebGL chrome has been swept to this law
(`StudioToolRail` 7.5→9, scrubber/meta labels 9→10.5–11, card labels
9→10.5–11).

**V4 bridge (globals.css):** all operator chrome tokens (`--canvas-base`,
`--surface-*`, `--ink-*`, `--line-*`, `--accent`, `--ok/--warn/--block/--info`)
resolve to this `--gs-*` namespace, and `--accent` is Gold (`--gs-primary`) —
one accent identity app-wide. The only intentional exception: the client
document sheet on portal surfaces stays light (`--portal-sheet`).

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
retained from the pre-Gold-Standard system. They describe real-world material
colors, not chrome, and remain in `color-tokens.css` under the dark theme.

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

## 3. Migration mapping (old → new)

For reference during the migration. Old tokens in `color-tokens.css` /
`handoffStudio.module.css` map as follows:

| Old token | New token | Note |
|-----------|-----------|------|
| `--canvas` (`--gray-l-50`) | `--gs-canvas` (`#101418`) | Board flips from cream to dark |
| `--hc-glass` | `--gs-glass` | Glass body |
| `--hc-neu-surface` / `--hc-neu-raised` | `--gs-glass` / `--gs-glass-strong` | Neumorphic plastic → flat glass |
| `--hc-ink` / `--hc-ink-muted` | `--gs-ink` / `--gs-ink-secondary` | Ink on glass |
| `--hc-line` | `--gs-line` | Hairline |
| `--danger` (`--crimson-*`) | `--gs-conflict` (`#ef4444`) | |
| `--success` (`--sprout-*`) | `--gs-success` (`#22c55e`) | |
| `--warning` | `--gs-warning` (`#f59e0b`) | |
| `--proposed-stroke` (`--cobalt-*`) | `--gs-truth` (`#0030CF`) | Proposed geometry = Signal Blue |
| `--easement-stroke` (`--slate-*`) | `--gs-truth` | Easements = Signal Blue |
| `--existing-stroke` (`--crimson-*`) | `--gs-conflict` (`#ef4444`) | Existing = Strike Red (semantic: "what's there") |
| `--font-ui` (Sora) | `--font-ui` (Inter) | |
| `--font-body` (IBM Plex Sans) | `--font-ui` (Inter) | |
| `--font-mono` (IBM Plex Mono) | `--font-tech` (Space Grotesk) | |

---

## 4. Contrast

All text on glass must meet **WCAG 2.2 AA** (4.5:1 for body, 3:1 for large).
The dark canvas changes every contrast pair — the gate
`e2e/canvas-contrast-aa.spec.ts` is retrained against Studio Dark in Phase 0.6.

Known-good pairs (verified):
- `--gs-ink` (`#E8E9EC`) on `--gs-glass`@70% over `--gs-canvas`: ~14.8:1 ✅
- `--gs-ink-secondary` (`#9AA0AC`) on same: ~6.4:1 ✅
- `--gs-ink-muted` (`#8B8F96`) on same: ~5.1:1 ✅
- `--gs-primary` (`#fbbf24`) on `--gs-glass`: ~10.2:1 ✅
- `--gs-ink-truth` (`#6B8EEA`) on `--gs-glass`: ~5.1:1 ✅ (not raw `#0030CF`, which is ~2.1:1 on dark)
- `--gs-ink-conflict` (`#F87171`) on `--gs-glass`: ~5.8:1 ✅ (not raw `#ef4444`, which is ~3.4:1)
