# FieldLoop v0.1 — Design System (Precision Glass-Chrome · 2026)

Leica's mechanical functionalism fused with modern glass and chrome: an **optical
instrument** aesthetic — dark translucent chassis, milled metallic edges, and
uncompromising visual hierarchy. Desktop-first web; mobile is the touch-first
field surface.

### Why Precision Glass-Chrome

It fixes the core failure of ordinary glassmorphism — the cheap, floaty iOS-widget
look — by grounding the UI like physical laboratory or optical hardware.

- **Perceived tactile weight.** Dark mode alone reads flat; milled chrome borders
  and dense smoked glass give elements physical mass. Buttons feel like machined
  brass dials or anodized-aluminium toggles, not flat digital rectangles.
- **Disciplined restraint.** Glowing accents are locked strictly to status
  signals (the Leica red dot, optical focus rings), which avoids the "RGB gamer"
  aesthetic and keeps the interface professional, utilitarian, and focused on the
  user's workflow.
- **Pro-grade positioning.** This is the language of high-end technical tools,
  desktop CAD software, audio plugins, and diagnostic dashboards — precision,
  high engineering standards, premium software.

These three statements are the design intent; §1–§9 are the executable tokens and
rules. The UI MUST NOT trade them away for floaty glassmorphism or ambient colour.

The aesthetic is **fully specified, not a starting point**. The implementer has
no latitude to reinterpret tokens, materials, radii, or interaction principles —
they are rendered exactly as written. Freedom of implementation ends where the
look begins.

## 1. Design language

- **Dense, heavy translucency** — not airy multi-color glassmorphism. A single
  dark smoked-glass layer that feels like looking into a sealed optical lens;
  blur isolates the active work surface while preserving spatial context beneath.
- **Machined chrome** — 1 px gradient metallic strokes and inset borders give
  every surface a polished, milled lip.
- **Functional light, not ambient glow** — colour is reserved for status LEDs
  (aperture red / amber), never decorative bleed.
- **Instrument-grade legibility** — stark white and high-contrast grey text with
  tabular monospace data readouts, readable under direct glare.

## 2. Colour tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--pgc-base` | `#121417` | Chassis base (opaque fallback) |
| `--pgc-base-alpha` | `rgba(18,20,23,0.88)` | Frosted smoked-glass fill |
| `--pgc-ink` | `#F8F9FA` | Primary text (stark white) |
| `--pgc-ink-secondary` | `#A1A1AA` | Secondary text (high-contrast grey) |
| `--pgc-red` | `#E60000` | Aperture red — active/selected focus ring, destructive |
| `--pgc-amber` | `#FFB800` | Amber status LED — processing / background work |
| `--pgc-green` | `#00C853` | Green status LED — pass / certified compliant |
| `--pgc-chrome-hi` | `rgba(255,255,255,0.25)` | Chrome stroke highlight (top) |
| `--pgc-chrome-lo` | `rgba(0,0,0,0.8)` | Chrome stroke shadow (bottom) |

Rule: red and amber are **unblurred, high-saturation status marks** with zero
ambient bleed — never general CTAs, never gradients, never glows.

## 3. Typography

| Role | Face | Notes |
|------|------|-------|
| Technical sans (headings/UI) | DIN, fallback Inter | Instrument labels, titles |
| Body / UI | Inter | Forms, notes |
| Data readouts | JetBrains Mono (tabular) | Pressures, totals, timers, job refs — `font-variant-numeric: tabular-nums` |

Colour: primary `#F8F9FA`, secondary `#A1A1AA`. On-site input font ≥ **16 px**.

## 4. Material tokens (CSS)

```css
:root {
  --pgc-base: #121417;
  --pgc-base-alpha: rgba(18,20,23,0.88);
  --pgc-ink: #F8F9FA;
  --pgc-ink-secondary: #A1A1AA;
  --pgc-red: #E60000;
  --pgc-amber: #FFB800;
  --pgc-green: #00C853;

  --pgc-blur: 20px;
  --pgc-radius: 4px;        /* hard corners */
  --pgc-radius-panel: 6px;  /* chamfered-feel panels */
  --pgc-chamfer: 4px;       /* 45° machined corner cut */

  /* Milled chrome stroke: polished metallic lip around dark surfaces. */
  --pgc-chrome: linear-gradient(
    180deg,
    rgba(255,255,255,0.25) 0%,
    rgba(0,0,0,0.8) 100%
  );

  /* Tactile contact shadow — grounds translucent cards like hardware. */
  --pgc-shadow: 0px 4px 12px rgba(0,0,0,0.6);
  --pgc-shadow-lifted: 0px 8px 24px rgba(0,0,0,0.65);
}

/* Frosted smoked glass + milled chrome stroke (border via padding-box/border-box). */
.precision-glass {
  border: 1px solid transparent;
  background:
    linear-gradient(var(--pgc-base-alpha), var(--pgc-base-alpha)) padding-box,
    var(--pgc-chrome) border-box;
  -webkit-backdrop-filter: blur(var(--pgc-blur));
  backdrop-filter: blur(var(--pgc-blur));
  border-radius: var(--pgc-radius-panel);
  box-shadow: var(--pgc-shadow);
}
```

## 5. Key interaction principles

### 5.1 Dense, heavy translucency

Avoid airy, multi-coloured glassmorphism. The glass layer should feel dense and
heavy — like looking into the aperture of a sealed optical lens. Background blur
isolates the active work surface while maintaining spatial context beneath.

- One smoked-glass material (`--pgc-base-alpha` + `--pgc-blur`); no colourful
  tints, no rainbow gradients, no light-leak washes.
- Blur lifts the focused card; the layer beneath stays dimly visible for context.

### 5.2 Machined button & input affordances

Interactive elements feature subtle metallic gradients, hard or chamfered
corners, and high-contrast inset borders. When pressed, the chrome edge inverts
and the surface depresses slightly — the tactile feedback of a precision
mechanical shutter release.

- Corners: **hard 4 px**, or **chamfered** (45° corner cut, `--pgc-chamfer: 4px`).
- Inputs carry a **high-contrast inset border** — a light inner top edge and a
  dark inner bottom edge (the inverse of the chrome lip).

```css
/* Chamfered machined corner */
.machined--chamfer {
  clip-path: polygon(
    var(--pgc-chamfer) 0, 100% 0, 100% calc(100% - var(--pgc-chamfer)),
    calc(100% - var(--pgc-chamfer)) 100%, 0 100%, 0 var(--pgc-chamfer)
  );
}

/* Input: high-contrast inset border */
.input-machined {
  border: 1px solid transparent;
  background:
    linear-gradient(rgba(18,20,23,0.88), rgba(18,20,23,0.88)) padding-box,
    var(--pgc-chrome) border-box;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.18),
    inset 0 -1px 0 rgba(0,0,0,0.8);
  border-radius: var(--pgc-radius);
  color: var(--pgc-ink);
}

/* Button: metallic gradient + chrome lip; shutter-release press */
.btn-machined {
  border: 1px solid transparent;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.08), rgba(18,20,23,0.9)) padding-box,
    var(--pgc-chrome) border-box;
  border-radius: var(--pgc-radius);
  color: var(--pgc-ink);
  box-shadow: var(--pgc-shadow);
  transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease;
}
.btn-machined:active {
  transform: translateY(1px);
  box-shadow: 0px 2px 6px rgba(0,0,0,0.6);
  background:
    linear-gradient(180deg, rgba(18,20,23,0.9), rgba(255,255,255,0.08)) padding-box,
    linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(255,255,255,0.35) 100%) border-box;
}
```

### 5.3 Instrument-grade typography

Pair high-legibility technical sans-serifs (DIN or Inter) with tabular monospace
figures for data readouts. Text stays stark white (`#F8F9FA`) or high-contrast
grey (`#A1A1AA`) — absolute legibility under direct glare or high ambient light.
Full type scale in §3; numeric readouts always `font-variant-numeric: tabular-nums`.

### 5.4 Targeted focal indicators

- Active/selected tool: razor-sharp **1 px aperture-red ring** (`#E60000`).
- Background process: **amber status LED** pulse.
- Glows are restricted to physical states only — no decorative glow.

```css
[data-selected="true"], :focus-visible {
  outline: 1px solid var(--pgc-red);
  outline-offset: 2px;
}
.status-led--amber {
  background: var(--pgc-amber);
  animation: led-pulse 1.2s steps(2, start) infinite;
}
@keyframes led-pulse { 50% { opacity: 0.4; } }
```

## 6. Theme code

### Tailwind (web)

```ts
// apps/web/tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        base: '#121417',
        ink: '#F8F9FA',
        'ink-secondary': '#A1A1AA',
        'aperture-red': '#E60000',
        'amber-led': '#FFB800',
        'green-led': '#00C853',
      },
      fontFamily: {
        technical: ['DIN', 'Inter', 'sans-serif'],
        ui: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
      borderRadius: { panel: '6px', hard: '4px' },
      boxShadow: {
        tactile: '0px 4px 12px rgba(0,0,0,0.6)',
        'tactile-lifted': '0px 8px 24px rgba(0,0,0,0.65)',
      },
    },
  },
};
```

### React Native (mobile)

RN has no native `backdrop-filter`; use `expo-blur` (`tint="dark"`) as the glass
backdrop with a dark translucent overlay, and `expo-linear-gradient` for the
chrome stroke:

```ts
// apps/mobile/theme/tokens.ts
export const tokens = {
  base: '#121417',
  ink: '#F8F9FA',
  inkSecondary: '#A1A1AA',
  apertureRed: '#E60000',
  amberLed: '#FFB800',
  greenLed: '#00C853',
  radiusHard: 4,
  radiusPanel: 6,
  touchMinHeight: 56,
  touchPadding: 16,
};
```

```tsx
// PrecisionGlassCard.tsx — BlurView (dark) + chrome stroke wrapper
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';

export function PrecisionGlassCard({ children }: { children: React.ReactNode }) {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.25)', 'rgba(0,0,0,0.8)']}
      style={{ borderRadius: 6, padding: 1 }}
    >
      <BlurView intensity={70} tint="dark" style={{ borderRadius: 5, overflow: 'hidden' }}>
        <View style={{ backgroundColor: 'rgba(18,20,23,0.88)' }}>{children}</View>
      </BlurView>
    </LinearGradient>
  );
}
```

## 7. Card directive (Precision Glass-Chrome)

Every content container is a precision-glass card. This directive is normative —
all 12 screens SHALL be rendered as precision-glass card compositions.

### 7.1 Anatomy (top to bottom)

1. **Header strip** — title (DIN/Inter, `#F8F9FA`), optional entity badge,
   optional status LED (right-aligned).
2. **Body** — form fields, checklist rows, evidence images, or summary content
   on smoked glass.
3. **Footer** — the single primary action, plus optional secondary.

### 7.2 Variants

| Variant | Use | Treatment |
|---------|-----|-----------|
| **Form card** | JSA/SWMS, specialty, quote, PO, invoice | Smoked glass, machined input rows at 56 px |
| **Summary card** | Signoff summary, totals, revenue | Tabular-mono numeric readouts, hairline dividers |
| **Evidence card** | Before/after + hazard photos | Image fills body, chrome stroke, kind badge overlay |
| **Compliance card** | VBA cert, gas test, backflow/TMV | Status LED header (green pass / red fail / amber pending) |
| **Referral card** | Cross-trade referral | Smoked glass, division select list, target badge |
| **Scheduler card** | Web dispatch canvas | Draggable precision-glass card, tech + time chips, status LED dot |

### 7.3 States

| State | Treatment |
|-------|-----------|
| Default | `--pgc-base-alpha` fill + chrome stroke + tactile shadow |
| Selected / active | 1 px aperture-red ring (`#E60000`) + lifted shadow |
| Disabled | 40% opacity, no shadow |
| Error | 1 px `#E60000` stroke + red status LED |
| Success / certified | 1 px `#00C853` stroke + green status LED |

## 8. Adaptive fallback

Glass is decorative; legibility is mandatory. The dark chassis is already
glare-friendly, so the fallback is minimal — it removes translucency, keeps the
solid base and chrome stroke:

```css
@media (prefers-reduced-transparency: reduce),
       (prefers-contrast: more) {
  .precision-glass {
    background: var(--pgc-base);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
    border: 1px solid rgba(255,255,255,0.16);
  }
}
```

## 9. Component primitives

- **Machined button (primary)** — dark smoked-glass fill, chrome stroke, white
  ink, tactile shadow; shutter-release press. Clock-in, approve, sign-off.
- **Destructive button** — chrome stroke with 1 px aperture-red ring and red
  ink; lodge-certificate and irreversible actions only.
- **Ghost button** — transparent fill, chrome stroke only, `#F8F9FA` ink; secondary.
- **Status LED** — pill, high-saturation, no glow: green pass, red fail, amber
  processing/pending, grey off-duty.
