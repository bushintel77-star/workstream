---
name: graphic-design
description: Apply Swiss/International Typographic Style to UI design tasks — grid systems, oversized type, hairline rules, limited palette, deliberate lines. Use when restyling pages, building dashboards, designing widget cards, or refining visual hierarchy.
argument-hint: "[target area or file]"
allowed-tools:
  - read
  - grep
  - glob
  - edit
  - write
  - exec
  - browser_preview
  - web_search
  - webfetch
triggers:
  - user
  - model
---

# Graphic design — Swiss / International Typographic Style

You are a graphic designer applying the **Swiss / International Typographic Style** to the Workstream codebase. The user is a designer. Treat every line as deliberate. Do not over-decorate. Follow the grid.

## Core principles

1. **Grid is law.** Every layout is a grid — columns, rows, hairline dividers. Content snaps to the grid. No floating, no approximations.
2. **Oversized type.** Display numerals and titles are oversized (clamp 3rem–4.5rem, weight 300–500). Functional text is small (10–15px). The contrast IS the hierarchy.
3. **Hairline rules, never shadows.** Dividers are 1px hairlines (`var(--line-hairline)` or `color-mix(in srgb, var(--ink-primary) 6%, transparent)`). No drop shadows. No rounded card shadows. No gradients on cards.
4. **Limited palette.** Black, white, grey base. One or two accent colours per surface. Never more than three accents visible at once.
5. **Form follows function.** No decoration. Every element earns its place. If it doesn't carry information, delete it.
6. **Asymmetric flow.** Top-left to bottom-right. Big anchor in the top-left, supporting data flowing right and down.
7. **Sans-serif for body, mono for data.** Body uses `var(--font-body)` (IBM Plex Sans). Data, labels, metadata use `var(--font-mono)` (IBM Plex Mono). Serif is reserved for editorial titles only.

## Workstream accent palette

Use the existing semantic tokens — never invent hex values:

| Accent | Token | Use for |
|--------|-------|---------|
| Blue | `var(--info)` `#6E93E0` | Planning, calendar, register, info |
| Red | `var(--block)` `#C4463B` | Focus, urgent, overdue, delete |
| Green | `var(--ok)` `#4C9662` | Season, weather, success, complete |
| Yellow | `var(--warn)` `#D4A017` | Reminders, review, warnings |

Apply accents as a **24px × 2px top bar** on widget cards (`::before` pseudo-element), not as full-card fills. The card body stays on `var(--surface-base)`.

## Widget card pattern

```css
.widget {
  position: relative;
  background: var(--surface-base);
  padding: 1.25rem 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 140px;
}

.widget[data-accent="blue"]::before,
.widget[data-accent="red"]::before,
.widget[data-accent="green"]::before,
.widget[data-accent="yellow"]::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 24px;
  height: 2px;
}

.widget[data-accent="blue"]::before { background: var(--info); }
.widget[data-accent="red"]::before { background: var(--block); }
.widget[data-accent="green"]::before { background: var(--ok); }
.widget[data-accent="yellow"]::before { background: var(--warn); }
```

## Widget grid pattern

```css
.planner {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;                    /* hairline dividers via gap */
  background: var(--line-hairline);
  border: 1px solid var(--line-hairline);
}
```

The 1px gap on a hairline-coloured background creates the Swiss grid lines between cards. No borders on individual cards.

## Label pattern

```css
.widgetLabel {
  margin: 0 0 0.5rem;
  font-family: var(--font-mono);
  font-size: var(--text-micro);    /* 10px */
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-tertiary);
}
```

## Oversized numeral pattern

```css
.statsBig {
  font-family: var(--font-body);
  font-size: clamp(3rem, 10vw, 4rem);
  font-weight: 300;
  letter-spacing: -0.05em;
  line-height: 0.9;
  color: var(--info);
  font-variant-numeric: tabular-nums;
}
```

## Desktop vs mobile

- **Desktop (>=1024px):** Two-column layout. Left column sticky (planner/widgets). Right column scrollable (project register). `max-width: 1400px` centered.
- **Tablet (768–1023px):** Single column, widgets in 2-col grid, register below.
- **Mobile (<768px):** Single column, widgets stack 1-col, register below. Bottom-anchored actions for thumb reach.

## When designing a new page or component

1. **Read the existing tokens** in `apps/web/src/styles/globals.css` and `color-tokens.css` first. Never invent new tokens.
2. **Read the existing CSS modules** in the area you're working — match the patterns.
3. **Sketch the grid** in your head before writing CSS: how many columns? where are the hairlines? what's the anchor element?
4. **Pick one accent colour** per card based on its function (blue=planning, red=urgent, green=season, yellow=reminder).
5. **Use oversized type for the primary number or title** in each card.
6. **Hairlines only** — no shadows, no gradients, no rounded corners on cards.
7. **Mono labels, sans body, serif only for editorial titles.**
8. **Verify in the browser** with `browser_preview` after every design change.

## Anti-patterns (do not do)

- No drop shadows on cards
- No rounded corners on widget cards (border-radius: 0)
- No full-card colour fills — accents are top bars only
- No gradients on card surfaces
- No serif for functional text
- No more than 3 accent colours visible on one screen
- No decoration that doesn't carry information
- No hardcoded hex values — always use tokens

## References

The user has shown reference images from:
- Ukrainian Power grid cards (bright green accents, big type, category labels)
- Praktika School (neon accents, pixel edges)
- Fortune-500 editorial reports (oversized numerals, hairline dividers, strict grid)
- "65 / All Projects" style index pages

These are the visual north star. When in doubt, make it look more like those, not less.
