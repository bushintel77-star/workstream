# Copy-paste prompts — designer handover

Use with:

- **Design in:** [DESIGNER-HANDOVER.md](../DESIGNER-HANDOVER.md) + [DESIGN-HANDOVER-FORMAT.md](../DESIGN-HANDOVER-FORMAT.md)
- **Design out:** [templates/DESIGN-RETURN-TEMPLATE.md](./DESIGN-RETURN-TEMPLATE.md)

---

## Prompt 1 — Kickoff (give designer at start)

```text
You are redesigning the Workstream operator web app — layout and/or the aerial Design Studio — for Curtis & Co (Melbourne landscape studio).

Before you draw anything, read these repo docs in order:
1. docs/DESIGNER-HANDOVER.md — product context, workflow, studio spec, tokens, what is deferred
2. docs/DESIGN-HANDOVER-FORMAT.md — how to structure Figma and what we need at handback

Live reference: https://web-production-3c194.up.railway.app
Design studio: open any project → Design → Open design studio

Your job:
- Propose a visual and layout redesign within the product constraints (concept sketch not CAD, 2D aerial only, permanent honesty copy, Workstream operator brand vs Curtis & Co on portal only).
- You have wide creative freedom on layout, hierarchy, components, depth, and interaction — document any breaking changes in the return template.
- Organise Figma exactly as DESIGN-HANDOVER-FORMAT.md § “Figma file structure”.
- Map all colours to CSS token names from apps/web/src/styles/globals.css; propose new tokens in writing, do not invent orphan hex in final comps.

Deliver work using Prompt 2 below when ready for engineering.
Package specs per docs/DESIGN-TO-CODE-SPEC.md (folder of small files + file-map.md — not one monolithic doc).
Do not hand back PDF-only or “see Figma” without the filled return template.
```

---

## Prompt 2 — Handback (give designer when submitting)

```text
Hand back your Workstream design for engineering build.

Required deliverables (all mandatory):
1. Figma link with dev mode — pages match docs/DESIGN-HANDOVER-FORMAT.md structure
2. Copy docs/templates/DESIGN-RETURN-TEMPLATE.md → docs/design-returns/YYYY-MM-DD-<feature>.md and fill every section in scope (delete blockquote instructions when done)
3. Token delta table — new/changed/removed vs apps/web/src/styles/globals.css
4. Copy deck — all en-AU strings in §7
5. Component map — Figma component → React/CSS module path (§5)

Confirm in §1:
- Concept sketch / not CAD honesty copy is designed and non-dismissible
- 2D top-down aerial only (no 3D or photoreal)
- Accent used ≤3% surface (Save + armed Place/Draw only) unless §4 documents an approved token change
- Canvas payload unchanged OR §11 lists breaking changes for eng review

Optional: ≤5 min Loom for design studio interactions.

Engineering will not start implementation until the return markdown is complete and Figma matches it.
```

---

## Prompt 3 — For Figma AI / external designer (single message)

```text
Project: Workstream — operator web redesign (Melbourne landscape co-pilot).

Read first (concept + format):
- DESIGNER-HANDOVER.md
- DESIGN-HANDOVER-FORMAT.md

Output:
- Figma: Foundations, Components, Templates, Design studio (375/720/960+), all states
- Markdown: fill DESIGN-RETURN-TEMPLATE.md completely for sections in scope

Hard rules:
- Operator UI = Workstream; client portal = Curtis & Co (separate file)
- Design studio = back-of-envelope concept on Mapbox aerial, NOT CAD
- Always show: “Concept sketch for estimating — not a construction drawing”
- Tokens align to globals.css; document deltas
- 44px touch targets, WCAG AA, sentence case, en-AU

Reference: https://web-production-3c194.up.railway.app/projects → Design → Design studio
```

---

## Prompt 4 — For Cursor / eng implementing a design return

```text
Implement the approved design return at docs/design-returns/<file>.md.

Rules:
- Match Figma + return doc; flag deviations in PR description
- Use CSS variables from apps/web/src/styles/globals.css only — add new tokens to globals first if §4 requires them
- CSS Modules per page/component; no CSS-in-JS; mobile-first breakpoints 375 / 720 / 960
- Do not break DesignCanvas payload (placements x_pct/y_pct, strokes) unless return doc §11 explicitly approves
- Preserve honesty copy zones from return doc §7
- Run pnpm --filter @workstream/web exec tsc --noEmit and pnpm test before finishing

Source spec: linked Figma in the return doc §0.
```

---

*Pair Prompt 1 + 2 with human designers. Prompt 3 for contractors. Prompt 4 for engineering.*
