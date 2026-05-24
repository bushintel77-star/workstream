# Design return — package spec

**Purpose:** How to **split** a design handback into multiple files instead of one monolithic markdown doc. Engineering reads the **index first**, then only the files in scope.

**Related:** [DESIGN-HANDOVER-FORMAT.md](../DESIGN-HANDOVER-FORMAT.md) · split templates in [templates/design-return/](../templates/design-return/)

---

## Why not one file?

| Problem with single file | Multi-file fix |
| --- | --- |
| 300+ lines nobody reads | Index + focused docs per concern |
| Copy deck churns layout spec in git | `copy.md` updates independently |
| Token export reused across projects | `tokens.json` + `tokens.md` stable |
| Eng only building studio opens whole doc | Read `studio/` folder only |
| Sign-off buried at bottom | `sign-off.md` is the gate |

---

## Package location

Each handback is **one folder**:

```text
docs/design-returns/
  YYYY-MM-DD-<short-name>/
    README.md              ← index (required) — start here
    scope.md               ← required
    routes.md              ← required if any screen changes
    tokens/
      tokens.md            ← human-readable delta
      tokens.json          ← optional machine-readable export
    layout/
      global-chrome.md     ← optional — skip if unchanged
      design-studio.md     ← optional — studio only
      <screen-name>.md     ← one file per major template
    components.md          ← required if components change
    interaction.md         ← required for studio or new flows
    copy.md                ← required — all strings
    states.md              ← required
    accessibility.md       ← required
    assets/
      README.md            ← what is exported and where
      icons/               ← SVG only
      symbols/             ← studio SVG path specs if new
    engineering.md         ← build order, do-not-break, open questions
    sign-off.md            ← design complete + QA punch list
```

**Naming:** `YYYY-MM-DD` = handback date; `<short-name>` = kebab-case, e.g. `studio-v2`, `operator-chrome`, `portal-deposit`.

**Example:** `docs/design-returns/2026-06-01-studio-v2/`

---

## File responsibilities

### `README.md` (index — required)

Single entry point. **Max ~80 lines.** Must include:

- Meta table (designer, date, Figma link, eng contact, target ship)
- 2–3 sentence summary
- Checklist of files in this package with ✅ / ⏭ skipped
- Links to every sibling file
- Figma page names in scope

Do **not** duplicate full tables from child files — link only.

### `scope.md` (required)

- In scope / out of scope lists
- Product constraint checkboxes (CAD honesty, 2D, accent budget, brand split)
- No layout detail here

### `routes.md` (required if screens change)

- Table: screen name, route, breakpoints designed
- Optional mermaid flow (or link Figma prototype)
- No copy, no tokens

### `tokens/tokens.md` (required if any visual change)

- New / changed / deprecated tokens vs `globals.css`
- Figma variable name ↔ CSS custom property
- `tokens.json` optional — same data, schema below

### `layout/*.md` (one concern per file)

| File | When to include |
| --- | --- |
| `global-chrome.md` | AppNav, masthead, subnav, bottom bar |
| `design-studio.md` | Studio toolbar, canvas, rail, honesty caption |
| `dashboard.md` | Dashboard-only layout |
| `project-hub.md` | Overview tab |
| Add others as needed | One markdown per major template |

Each layout file: regions, dimensions, sticky behaviour, breakpoint table. **No interaction logic** (that is `interaction.md`).

### `components.md` (required if components change)

- Figma component → code path map
- New components table with suggested `apps/web/src/...` paths
- Variant/state matrix

### `interaction.md` (required for studio or new flows)

- Action → behaviour tables
- Keyboard shortcuts
- Mode / armed / select visuals
- No copy strings (link `copy.md`)

### `copy.md` (required)

- **All** user-visible strings (en-AU)
- Columns: `id`, `location`, `element`, `copy`, `notes`
- Use stable `id` slugs (e.g. `studio.honesty.caption`) so eng can grep

### `states.md` (required)

- State × screen × Figma frame name × eng notes
- Loading / empty / error / success

### `accessibility.md` (required)

- Contrast, focus, touch targets, reduced motion, SR labels
- Known risks

### `assets/README.md` (required if assets ship)

- What is included, format, target path in repo
- Explicit: no Mapbox tile exports

### `engineering.md` (required)

- Suggested build order
- Do-not-break list (canvas payload, honesty copy ids from `copy.md`)
- Open questions table

### `sign-off.md` (required)

- Design complete checklist
- Eng PR / preview URL table
- Design QA matrix + punch list

---

## Optional `tokens/tokens.json` schema

```json
{
  "version": 1,
  "base": "apps/web/src/styles/globals.css",
  "added": [
    { "css": "--surface-overlay", "light": "#FFFFFF", "dark": "#222228", "usage": "Dropdown menus" }
  ],
  "changed": [],
  "deprecated": []
}
```

Commit JSON only if Figma Tokens / Variables export is automated; otherwise `tokens.md` alone is fine.

---

## What to skip

Mark skipped files in `README.md` checklist as **⏭ skipped — reason**.

| File | Skip when |
| --- | --- |
| `layout/global-chrome.md` | Chrome unchanged |
| `layout/design-studio.md` | Studio not in scope |
| `tokens/*` | Pure copy change, zero visual delta |
| `assets/*` | No new SVG/icons |
| `interaction.md` | Layout-only reskin, zero behaviour change |

**Never skip:** `README.md`, `scope.md`, `copy.md` (if any copy touched), `sign-off.md`.

---

## Figma ↔ folder mapping

| Figma page | Package files |
| --- | --- |
| `01 — Foundations` | `tokens/` |
| `02 — Components` | `components.md` |
| `03 — Templates` | `layout/<screen>.md`, `routes.md` |
| `04 — Design studio` | `layout/design-studio.md`, `interaction.md`, `states.md` |
| `05 — Portal` | Separate package folder recommended: `YYYY-MM-DD-portal-*` |

---

## Delivery methods

| Method | Acceptable? |
| --- | --- |
| Git branch / PR with `docs/design-returns/YYYY-MM-DD-*` | **Preferred** |
| Zip with same folder structure | Yes — unzip into `docs/design-returns/` |
| Notion export | Yes — one Notion page per file, same filenames |
| Single 500-line markdown | **No** — split before handback |

---

## Engineering read order

1. `README.md`
2. `scope.md` + `engineering.md`
3. `tokens/` if present
4. `layout/*` for screens in PR scope
5. `components.md` + `interaction.md`
6. `copy.md` + `states.md` + `accessibility.md`
7. Implement → update `sign-off.md`

---

## Starter kit

Copy the empty folder:

```text
docs/templates/design-return/
```

to `docs/design-returns/YYYY-MM-DD-<name>/` and delete files marked `(optional)` in the template README if not needed.

---

## Monolithic template (legacy)

The all-in-one [DESIGN-RETURN-TEMPLATE.md](../templates/DESIGN-RETURN-TEMPLATE.md) remains valid for **small** handbacks (≤1 screen, no token changes). For studio redesign or multi-template work, **use this package spec**.

---

*Version: 2026-05-21*
