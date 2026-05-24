# Design → code spec (Workstream web)

**Audience:** Designer (or design engineer) handing work that must **drop into the existing Next.js codebase** without a rewrite.

**Goal:** Every Figma frame and spec section maps to a **known file path** and **CSS module**. Engineering implements by editing those files — not inventing a parallel structure.

---

## 1. How this app is built (30 seconds)

```text
apps/web/src/
├── styles/
│   ├── globals.css          ← design tokens ONLY (--surface-*, --ink-*, --accent)
│   ├── app.module.css       ← shared primitives (.page, .btn, .card, .pill…)
│   └── skeleton.module.css  ← loading placeholders
├── app/                     ← Next.js routes (pages = server components by default)
│   ├── page.tsx             ← dashboard
│   ├── loading.tsx          ← route skeleton
│   ├── dashboard.module.css ← dashboard-only layout
│   └── projects/[id]/
│       ├── page.tsx         ← project hub
│       ├── project.module.css
│       └── design/studio/page.tsx
└── components/              ← reusable UI (+ matching *.module.css)
    ├── AppNav.tsx + app-nav.module.css
    ├── DesignStudio.tsx + designStudio.module.css
    └── studio/              ← design studio sub-components
```

**Rules engineers follow (you must design to match):**

- **CSS Modules only** — no Tailwind, no CSS-in-JS, no inline `style={{}}`
- **Tokens in `globals.css`** — components use `var(--token-name)`, not hex
- **Mobile-first CSS** — base styles = phone; `@media (min-width: 720px)` and `960px` for up
- **Sentence case** copy; **en-AU** locale
- **44px** min tap targets; **16px** min input font size

---

## 2. Your deliverable = a file map (required)

Do **not** deliver one giant doc. Deliver a **folder of small files** (see §7) plus Figma.

For every screen you change, fill one row:

| Figma page / frame | Route | Page file | CSS module | Client components to restyle |
| --- | --- | --- | --- | --- |
| 04 — Design studio / Desktop | `/projects/:id/design/studio` | `app/projects/[id]/design/studio/page.tsx` | `components/designStudio.module.css` | `DesignStudio.tsx`, `studio/DesignAssetPalette.tsx`, `studio/designAssetPalette.module.css` |
| 03 — Dashboard | `/` | `app/page.tsx` | `app/dashboard.module.css` | `NewProjectAddressForm.tsx`, `DashboardProjectRow.tsx` |
| Project hub | `/projects/:id` | `app/projects/[id]/page.tsx` | `app/projects/[id]/project.module.css` | `ProjectShell.tsx` (masthead + subnav) |

**If you add a new UI block:** specify whether it is:

- **Primitive** (button, card, pill) → extend `styles/app.module.css`
- **Feature component** → new `components/YourName.tsx` + `components/yourName.module.css`
- **Page-only layout** → extend the route’s `*.module.css` next to `page.tsx`

---

## 3. Token changes (globals.css)

All colour, radius, shadow, and spacing **names** live in:

`apps/web/src/styles/globals.css`

When you change the visual system, deliver **`tokens.md`** (not scattered hex in Figma):

```markdown
## New
--surface-overlay: #FFFFFF;   /* elevated dropdowns */

## Changed
--accent: #B8380B;            /* was #C2410C — Save + armed mode only */

## Unchanged
Reference existing --surface-base, --elev-1, etc.
```

**Designer rule:** Figma variables must use the **same names** as CSS (slashes → hyphens: `surface/elevated` → `--surface-elevated`).

**Accent budget:** `--accent` only on **Save** and **armed Place/Draw** in design studio. Everything else uses ink + surfaces.

---

## 4. Primitives vs feature CSS

### Use `app.module.css` when

Same pattern appears on **2+ routes** (buttons, cards, pills, inputs, headlines, empty states, errors).

| Figma component | Class | File |
| --- | --- | --- |
| Primary button | `.btn` | `styles/app.module.css` |
| Accent CTA | `.btn.btnAccent` | same |
| Ghost button | `.btnGhost` | same |
| Card container | `.card` | same |
| Status pill | `.pill` + `.pillOk` / `.pillWarn` / … | same |
| Page shell | `.page` / `.pageNarrow` | same |
| Section label | `.sectionHeading` | same |
| Page title | `.headline` | same |
| Intro text | `.lede` | same |

**Do not** duplicate `.btn` styling in a feature module — extend the primitive.

### Use feature `*.module.css` when

Layout or styling is **unique to one feature** (design studio rail, quote portal, dashboard address field).

| Feature | CSS module |
| --- | --- |
| Design studio shell | `components/designStudio.module.css` |
| Asset rail tiles | `components/studio/designAssetPalette.module.css` |
| Project tab chrome | `app/projects/[id]/project.module.css` |
| App nav | `components/app-nav.module.css` |
| Portal quote | `app/portal/quote/[token]/quote.module.css` |

---

## 5. Design studio — file slots (redesign target)

If you redesign the studio, these are the **only** files engineering expects to touch for layout/skin:

| Slot | File | Your spec should define |
| --- | --- | --- |
| Page shell + copy | `app/projects/[id]/design/studio/page.tsx` | H1, lede, back link — strings in `copy/studio.md` |
| Studio layout + toolbar + canvas | `components/DesignStudio.tsx` | Structure only if DOM order changes |
| Studio styles | `components/designStudio.module.css` | Grid, toolbar, canvas, honesty caption |
| Asset rail | `components/studio/DesignAssetPalette.tsx` | Tile anatomy, search, categories |
| Rail styles | `components/studio/designAssetPalette.module.css` | |
| Symbol on canvas | `components/studio/DesignCanvasPlacement.tsx` | Selection handles, hit targets |
| Scale bar | `components/studio/ScaleBar.tsx` | Indicative metres label |
| Keyboard legend | `components/studio/KeyboardLegend.tsx` | |
| Loading route | `app/projects/[id]/design/studio/loading.tsx` | Uses `ProjectRouteLoading` or custom skeleton |

**Do not redesign in spec:**

- API routes, canvas JSON shape (`placements`, `strokes`, `x_pct`, `y_pct`)
- Catalog symbol data (`packages/domain/src/catalog.ts`) unless adding symbols via Settings flow

---

## 6. Breakpoints (match code)

Write CSS specs at these widths — they match existing `@media` queries:

| Name | Min width | Typical use |
| --- | --- | --- |
| Mobile | default (375) | Stacked layout, sticky bottom bar |
| Tablet | `720px` | Subnav static, 2-col grids |
| Desktop | `960px` | Design studio: canvas + 320px rail |

Example spec line:

```css
/* designStudio.module.css — mobile first */
.workspace { flex-direction: column; }
@media (min-width: 960px) {
  .workspace { display: grid; grid-template-columns: 1fr 320px; }
}
```

---

## 7. How to package files (not one monolith)

Deliver a **zip or repo folder** named `design-return-YYYY-MM-DD-<name>/`:

```text
design-return-2026-05-21-studio-v2/
├── README.md                 ← links Figma + 2-sentence summary
├── file-map.md               ← §2 table (Figma → code paths)
├── tokens.md                 ← §3 token delta
├── copy/
│   ├── studio.md             ← all strings for studio route
│   ├── dashboard.md          ← only if in scope
│   └── shared.md             ← nav, toasts, errors
├── layout/
│   ├── design-studio.md      ← regions, sizes, sticky behaviour
│   └── project-chrome.md     ← masthead + subnav if changed
├── components/
│   ├── asset-tile.md         ← tile states: default, active, TRP
│   ├── toolbar.md
│   └── buttons.md            ← only if changing primitives
├── interaction/
│   └── design-studio.md      ← click, drag, keyboard, modes
├── states/
│   └── design-studio.md      ← empty, saving, error, no-survey
├── a11y.md                   ← contrast, focus, touch targets
└── assets/
    └── icons/                ← SVG only, if new
```

**README.md** is the index. Engineering opens `file-map.md` first, then the relevant slice.

Optional: keep **`docs/design-returns/YYYY-MM-DD-<name>/`** in the repo with the same structure.

---

## 8. What to put in each markdown file

### `file-map.md` (mandatory)

One table: Figma frame → route → `.tsx` → `.module.css` → notes.

### `tokens.md` (mandatory if visual system changes)

New / changed / removed CSS variables with light + dark values.

### `copy/*.md` (mandatory)

```markdown
| key | location | text |
| --- | --- | --- |
| studio.h1 | page headline | Design studio |
| studio.honesty | canvas footer | Concept sketch for estimating — not a construction drawing. |
```

Engineering maps keys to JSX — no copy in Figma-only.

### `layout/*.md`

Per region:

- Dimensions (px or rem)
- Padding/gap (use `--s-*` scale: 4, 8, 12, 16, 24, 32, 48, 64)
- Sticky/fixed behaviour
- Z-index stacking (nav > subnav > bottom bar)

### `components/*.md`

Per component:

- Figma component name
- Target CSS module + **class names you want** (e.g. `.assetTile`, `.assetTileActive`)
- States: default, hover, focus, disabled, loading
- Spacing diagram (optional)

### `interaction/*.md`

Tables only — no prose essays:

| user action | result |
| --- | --- |
| Tap asset tile | Arm symbol; tile gets `.cardActive` |

### `states/*.md`

| state | Figma frame | visible elements |
| --- | --- | --- |
| Empty canvas | Studio / Empty | centred prompt |

### `a11y.md`

Contrast pairs, focus ring spec, exceptions to 44px rule.

---

## 9. Class naming conventions (match existing code)

| Pattern | Example | Use |
| --- | --- | --- |
| camelCase | `.subnavItem`, `.assetTile` | All CSS module classes |
| Element + state | `.modeBtnActive`, `.cardPlanning` | Variants |
| No BEM `--` | ❌ `.card__title` | Not used in this repo |
| Primitive in `app.module.css` | `.btn`, `.pillOk` | Shared |
| Feature-specific | `.workspace`, `.canvasCol` | Feature module |

Figma variant properties should mirror: `State=Active` → `.cardActive`.

---

## 10. Client vs server (design impact)

| UI pattern | Implementation | Design note |
| --- | --- | --- |
| Static page shell, copy, layout | Server component in `page.tsx` | Design the loaded state |
| Buttons that submit / save | Server action + `SubmitButton` | Show **loading** + spinner on button |
| Toasts | `useToast()` client | Bottom-centre glass toast |
| Design studio canvas | `DesignStudio.tsx` client | All interaction states |
| Destructive confirm | `window.confirm` or dedicated modal | Spec copy in `copy/` |

You do **not** write React — but spec **which states need client behaviour** (loading, drag, toast).

---

## 11. Do-not-break list (design studio)

These are **logic contracts** — visual redesign OK, behaviour spec must preserve:

| Contract | Why |
| --- | --- |
| Honesty caption always visible | Product/legal |
| Save → server action → toast with draftsperson line | Workflow |
| Placement at click % on aerial | Responsive canvas |
| TRP / Planning group pinned in rail | Council workflow |
| Asset code visible on every tile | Estimating + quote |
| Static aerial image (no map pan/zoom UI) | Implementation |

---

## 12. Acceptance — “slides into codebase”

Your handback is ready when:

- [ ] `file-map.md` lists every changed route and CSS module
- [ ] No orphan hex — all colours in `tokens.md` or marked “unchanged”
- [ ] Copy lives in `copy/*.md`, not only in Figma
- [ ] Breakpoints spec uses 720 / 960
- [ ] New UI either maps to `app.module.css` primitive or names a new `components/*.module.css`
- [ ] Figma component names match class names in spec
- [ ] `README.md` links Figma + folder structure

Engineering then: edit listed files, run `pnpm --filter @workstream/web exec tsc --noEmit`, ship PR.

---

## 13. Quick reference — common routes

| Screen | Route | Primary files |
| --- | --- | --- |
| Dashboard | `/` | `app/page.tsx`, `dashboard.module.css` |
| Confirm pin | `/confirm-pin` | `app/confirm-pin/`, `confirm-pin.module.css` |
| Project hub | `/projects/:id` | `app/projects/[id]/page.tsx`, `project.module.css` |
| Survey | `…/survey` | `app/projects/[id]/survey/page.tsx`, `sitePlan.module.css` |
| Design | `…/design` | `app/projects/[id]/design/page.tsx`, `design.module.css` |
| **Design studio** | `…/design/studio` | `DesignStudio.tsx`, `designStudio.module.css` |
| Costing | `…/costing` | `costing/page.tsx` |
| Settings | `/settings` | `app/settings/page.tsx`, `settings.module.css` |
| Portal quote | `/portal/quote/:token` | `QuotePortal.tsx`, `quote.module.css` |

---

*Related: [DESIGNER-HANDOVER.md](./DESIGNER-HANDOVER.md) (product context) · [DESIGN-HANDOVER-FORMAT.md](./DESIGN-HANDOVER-FORMAT.md) (process) · [templates/DESIGN-RETURN-TEMPLATE.md](./templates/DESIGN-RETURN-TEMPLATE.md) (single-file alternative)*
