# Design handover format (Workstream)

**Purpose:** One standard for design ↔ engineering on Workstream operator web (layout + design studio). Designers deliver to this format; engineering implements against it and rejects handbacks that skip required sections.

**Companion docs:**

| Direction | Doc |
| --- | --- |
| Design **in** (context for designers) | [DESIGNER-HANDOVER.md](./DESIGNER-HANDOVER.md) |
| Design **out** (fill when handing back) | [templates/DESIGN-RETURN-TEMPLATE.md](./templates/DESIGN-RETURN-TEMPLATE.md) |
| **Copy-paste prompts** | [templates/DESIGNER-PROMPTS.md](./templates/DESIGNER-PROMPTS.md) |
| **Design → code (file packaging)** | [DESIGN-TO-CODE-SPEC.md](./DESIGN-TO-CODE-SPEC.md) |

---

## Recommended stack (best format)

| Layer | Tool | Why |
| --- | --- | --- |
| **Visual source of truth** | **Figma** (one file per surface) | Components, variants, auto-layout, dev mode specs |
| **Tokens** | Figma variables → map to `globals.css` | Same names as code; no orphan hex |
| **Written spec** | **Filled `DESIGN-RETURN-TEMPLATE.md`** in repo or Notion export | Decisions Figma cannot capture (copy, logic, a11y, breakpoints) |
| **Prototype** | Figma prototype **or** linked flows only | Optional for studio interactions; not a substitute for component specs |
| **Assets** | SVG symbols only in repo; PNG/WebP for marketing only | Studio symbols are SVG `path_d` in domain catalog |

**Not accepted as sole handover:** PDF-only, screenshots in Slack, “see Figma” with no template, or a new colour/type system that ignores `globals.css`.

---

## Figma file structure (mandatory pages)

Create or reorganise files to match this exactly so devs can find specs:

```text
📁 Workstream — Operator web
├── 00 — Cover (link to DESIGN-RETURN-TEMPLATE, designer, date, Figma URL)
├── 01 — Foundations
│     ├── Colours (variables → CSS token names)
│     ├── Typography (Inter Display / Inter / JetBrains Mono)
│     ├── Spacing & radius (4px grid)
│     ├── Elevation (elev-1, elev-2, inset)
│     └── Motion (durations, easing — note reduced-motion)
├── 02 — Components
│     ├── Nav, subnav, pills, buttons, inputs, cards, toasts, spinners
│     └── Each: default + hover + focus + disabled + loading
├── 03 — Templates
│     ├── Dashboard
│     ├── Project hub (overview)
│     ├── Design page (workflow steps)
│     └── Settings hub
├── 04 — Design studio
│     ├── Desktop 960+ (toolbar + canvas + 320px rail)
│     ├── Tablet 720
│     ├── Mobile 375
│     └── States (empty, armed, selected, saving, aerial error)
├── 05 — Portal (optional separate file)
│     └── Curtis & Co client skin — do not merge with operator chrome
└── 99 — Archive (superseded explorations)
```

**Naming:** `Component / Variant / State` (e.g. `Button / Primary / Loading`).

**Component properties:** Use Figma variants for size, state, and theme (light/dark). Map variant names to CSS module class intent in the return template.

---

## Token mapping rule

Every colour in Figma must use a **variable** whose name matches (or is documented against) a CSS custom property in `apps/web/src/styles/globals.css`.

| Figma variable | CSS token |
| --- | --- |
| `surface/base` | `--surface-base` |
| `surface/elevated` | `--surface-elevated` |
| `ink/primary` | `--ink-primary` |
| `accent/default` | `--accent` |
| `line/hairline` | `--line-hairline` |
| `elev/1` | `--elev-1` |

**New tokens:** List in return template §4 with rationale. Engineering adds to `globals.css` first, then components.

**Forbidden:** Raw hex on components unless marked `LEGACY — migrate to token` in the return template.

---

## What designers must specify (checklist)

Engineering will not start without these:

### Layout & responsive

- [ ] Breakpoints: **375** (mobile), **720** (tablet), **960+** (desktop) — match existing codebase
- [ ] Max content width: 960px (`.page`) vs 720px (`.pageNarrow`)
- [ ] Sticky regions: AppNav, masthead, subnav, mobile bottom bar — heights documented
- [ ] Design studio rail width (current **320px** desktop) or proposed change with rationale

### Design studio (if in scope)

- [ ] Toolbar contents and order
- [ ] Mode bar vs modeless behaviour (must match [DESIGNER-HANDOVER.md §6.4](./DESIGNER-HANDOVER.md) unless explicitly changing product)
- [ ] Honesty copy placement (permanent, not dismissible)
- [ ] Empty, armed, selected, saving, error states
- [ ] Asset tile anatomy: glyph, code, label, TRP tag
- [ ] Planning group pinned above catalog
- [ ] Indicative scale bar + TPZ metre labelling

### Interaction & content

- [ ] All user-visible strings (en-AU, sentence case headings)
- [ ] Keyboard shortcuts (if changed) — table in return template
- [ ] Focus order and focus ring treatment
- [ ] Loading: skeleton vs spinner per surface
- [ ] Destructive actions: confirm copy

### Accessibility

- [ ] WCAG **AA** contrast on all text (especially asset rail — historical failure on tinted tiles)
- [ ] 44px minimum touch targets
- [ ] 16px minimum input font size (iOS zoom)
- [ ] `prefers-reduced-motion` behaviour noted

### Out of scope confirmation

- [ ] Designer confirms: no 3D, no CAD accuracy claims, no silent AI placement (Phase 6 not shipped)

---

## Handback deliverables (design → engineering)

When design is ready for build, deliver **all** of:

1. **Figma link** (view + dev mode) on page `00 — Cover`
2. **Completed** [DESIGN-RETURN-TEMPLATE.md](./templates/DESIGN-RETURN-TEMPLATE.md) (copy into `docs/design-returns/YYYY-MM-DD-<feature>.md`)
3. **Component inventory** — Figma component list mapped to existing or new React/CSS module paths
4. **Token delta** — new/changed/removed variables vs `globals.css`
5. **Copy deck** — all strings in one table (page, element, text)
6. **Redlines** — use Figma annotations OR a numbered list in the return template for anything non-obvious in dev mode

**Optional but valuable:**

- Loom walkthrough (≤5 min) for design studio interactions
- PNG exports only for marketing; **do not** export studio symbols as PNG — use SVG path handoff spec

---

## Engineering handback (build → design QA)

After implementation, engineering provides:

- Preview URL (local or Fly preview)
- List of intentional deviations (if any) with reason
- Screenshots at 375 / 960 for sign-off
- Pointer to CSS modules touched

Design signs off in the return doc §12 or files follow-up issues.

---

## Review cadence

| Gate | Owner | Output |
| --- | --- | --- |
| **Kickoff** | PM + design | Scope + link to DESIGNER-HANDOVER.md |
| **WIP review** | Design + eng | Figma 04 — Design studio states ≥80% |
| **Handback** | Design | Filled DESIGN-RETURN-TEMPLATE + Figma |
| **Build** | Eng | PR linked in return doc §11 |
| **QA** | Design | Sign-off or punch list in §12 |

---

## File naming in repo

```text
docs/
  DESIGNER-HANDOVER.md          ← context (design in)
  DESIGN-HANDOVER-FORMAT.md       ← this file (the standard)
  templates/
    DESIGN-RETURN-TEMPLATE.md   ← empty template (design out)
  design-returns/
    2026-05-21-studio-v2.md     ← filled examples per handback
```

---

## Quick answer: best format?

**Best:** Figma (structured as above) **+** filled **DESIGN-RETURN-TEMPLATE.md** with token map and copy deck.

**Avoid:** PDF-only, isolated FigJam without component specs, or redesigning in code without a return doc.

Designers work to this format; engineering implements only from complete handbacks.
