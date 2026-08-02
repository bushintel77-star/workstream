# Workstream Design DNA — shared across mobile + web

## The idea

Swiss / International Typographic Style, filtered through landscape
architecture drawing conventions. Not generic grid — **site plan grid**.

Curtis & Co draw site plans every day. Their visual language is:
boundary lines, setback dimensions, contour lines, north arrows,
scale bars, title blocks, hatching. The UI should feel like it
belongs to a landscape architecture practice, not a SaaS startup.

## Sibling rule

Mobile and web share:
- Token source (`@workstream/ui`)
- Type scale (IBM Plex Sans/Mono/Serif)
- Accent palette (info/blue, block/red, ok/green, warn/yellow)
- Index numbers (pad2 — 01, 02, 03)
- Status dot colors
- Arrow glyph (→)
- Masthead pattern (mark + title)
- Hairline dividers
- Widget vocabulary (date, weather, focus, reminders, season, todo, stats)

Mobile is the shorter sibling: same widgets in a horizontal scroll,
same project list, same accent bars. Desktop is the taller sibling:
two-column layout, sticky planner, full project register.

## Signature elements (beyond lines)

### 1. Dimension line divider
Hairline divider with architectural tick marks at each end. Replaces
plain `<hr>`. This is the single most recognizable element — it says
"drawing" not "web page".

```
|————————————|  ← tick marks at ends
```

Web: `border-top: 1px solid var(--line-hairline)` with `::before`
and `::after` pseudo-elements as 6px vertical ticks.

Mobile: a `View` with `borderTopWidth: 1` and two small `View`s
positioned at left/right edges.

### 2. Title block
Architectural drawings have a title block — a small tabular block
with project name, drawing number, scale, date. The masthead on
both apps is already close to this. Push it further: add a drawing
number ("DWG-001") and scale ("1:200") in mono micro text.

### 3. North arrow
A small N↑ glyph in the corner of the home page and canvas.
Recurring motif that says "this is a site plan tool."

### 4. Scale bar
A segmented bar (alternating filled/empty segments) at the bottom
of the home page. Decorative on home, functional on canvas. Shared
visual element.

### 5. Oversized index number as texture
The pad2 index numbers (01, 02, 03) are already shared. Push them
larger on desktop — they become the visual texture of the project
register, not just a label. On mobile, they stay compact but still
prominent.

### 6. Accent bar (24×2px)
Already on web widgets. Add to mobile cards too. The accent color
identifies the widget function at a glance: blue=planning,
red=urgent, green=season, yellow=reminder.

### 7. Contour background (optional, subtle)
A very faint topographic contour line pattern as the page
background — not a flat color, but a subtle texture that reads as
"site" not "screen." opacity 0.02, SVG, fixed position.

## Customization

Both apps have a widget settings panel:
- Toggle widgets on/off
- Reorder widgets (drag on desktop, long-press on mobile)
- Stored in localStorage (web) / AsyncStorage (mobile)
- Same widget IDs on both platforms

Widget IDs: `date`, `weather`, `focus`, `reminders`, `calendar`,
`season`, `todo`, `stats`.

## Type scale (shared)

| Role | Token | Size | Weight | Family |
|------|-------|------|--------|--------|
| Display | `displayL` | 32px | 600 | Sans |
| Title | `displayM` | 24px | 600 | Sans |
| Section | `title` | 18px | 600 | Sans |
| Body | `body` | 15px | 400 | Sans |
| Caption | `caption` | 13px | 500 | Sans |
| Label | `micro` | 11px | 600 | Mono |
| Data | `bodyMono` | 14px | 500 | Mono |

Oversized numerals (time, temp, count) break this scale on purpose:
clamp(3rem, 10vw, 4rem), weight 300. The contrast IS the hierarchy.

## Spacing (shared, 8px baseline)

4, 8, 12, 16, 24, 32, 48, 64. No in-between values. Everything
snaps to this scale.

## Color (shared)

| Token | Hex | Use |
|-------|-----|-----|
| `surface.base` | #14171C | Background |
| `surface.elevated` | #1B1E24 | Cards |
| `ink.primary` | #E8E9EC | Text |
| `ink.secondary` | #9AA0AC | Metadata |
| `ink.tertiary` | #6B7078 | Placeholders |
| `line.hairline` | #2A2D34 | Dividers |
| `semantic.info` | #6E93E0 | Planning, calendar |
| `semantic.block` | #C4463B | Urgent, delete |
| `semantic.ok` | #4C9662 | Season, weather, success |
| `semantic.warn` | #D4A017 | Reminders, review |

## Motion (shared)

- `easeStandard`: cubic-bezier(0.22, 1, 0.36, 1) — 140ms
- `easeEmphasis`: cubic-bezier(0.16, 1, 0.3, 1) — 260ms
- `durSlow`: 480ms — for drawer slides, sheet presents

## What NOT to do

- No drop shadows on cards
- No rounded corners on widget cards (radius 0)
- No full-card color fills — accents are top bars only
- No gradients on card surfaces
- No serif for functional text
- No more than 3 accent colors visible on one screen
- No decoration that doesn't carry information
- No hardcoded hex values — always use tokens
- No generic SaaS patterns (filter bars, chip clusters, card grids with shadows)
