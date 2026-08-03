# Devin brief — Workstream to production grade

> Paste everything below the line into Devin. Start a fresh session, Plan mode on,
> lead with the word `megaplan`, and make sure `Get-ChildItem` is allowlisted first —
> the last three runs died on a denied directory listing, not on the prompt.

---

## Mission

Take the Workstream app (`apps/web`, Curtis & Co landscape design studio) from its current
state to production grade. This is long-horizon work, not a single PR.

**Read `docs/design/00-DISCOVERY.md` first.** It is a codebase audit with file-and-line
citations, produced specifically to stop you rediscovering things. It also contains a
retraction section documenting a wrong conclusion and why — read that too, because the same
trap is available to you.

## The one thing to understand before you plan

**This repo does not need a new design system. It needs its existing specs enforced.**

There are 63 documents in `docs/`. `STUDIO-STYLING-AND-UX.md` is a *binding* spec for canvas
chrome with a pre-merge checklist (§6) that already encodes almost every UX critique anyone
would make: canvas-is-the-hero, one tool dock, ribbon-is-a-fixed-budget, degrade-invisibly,
discoverable-in-context, keyboard-and-pointer-and-gesture. `DESIGN-DNA.md` does the same for
the app shell. They are scoped to different surfaces and are *not* in conflict.

The gap is mechanical: **the checklist lives in markdown and nothing enforces it.** The
revision history at `STUDIO-STYLING-AND-UX.md:373` shows the cycle already repeating — a spec
written in response to drift, then more drift.

So the deliverable is not a redesign. It is: close the gap between the spec and the shipped
UI, and make the spec enforceable in CI so it stays closed.

## Already done — do not redo

Landed before you started (uncommitted in the working tree):

1. **Studio address resolution fixed.** `useStudioState.ts` — the real project address now
   wins unless the operator explicitly picks a demo site (new `ui.siteExplicit` flag set in
   the `switchSite` reducer). Previously `STUDIO_SITES[siteIdx]?.addr ?? (address || …)`
   made the project address structurally unreachable, which sent the cadastral lookup to the
   wrong parcel, which left `building` empty, which suppressed the dwelling envelope and every
   sun/shade cast. **Verify this typechecks and add a regression test — it was shipped without
   one because the toolchain was not runnable in the authoring environment.**
2. **Chip cluster overflow affordance.** `VicGovStatusChipRow.tsx` + `vicGovChips.module.css` —
   clusters now publish `data-overflow` / `data-scroll-end` via ResizeObserver and the
   stylesheet fades the trailing edge only while there is more to reach. All existing data
   attributes and ARIA preserved for `e2e/vic-gov-status-chips.spec.ts`.

## Phase 1 — Make the specs enforceable (do this first)

The precedent already exists and works: `scripts/check-handoff-chrome-colors.mjs` is a CI gate
against raw hex in handoff modules, and it is *why* token adoption measures 6,747 `var()`
usages against 68 raw hex literals. Replicate that pattern for the axes that have no gate:

- **z-index** — 63 of 218 declarations bypass the `--ws-z-*` scale, including `999`, `1000`,
  `1100`. `siteCanvas.module.css` and `present.module.css` hold 23 between them.
- **border-radius** — 10 arbitrary values in use (1,2,3,4,8,9,12,16,26,999px).
- **opacity** — 10 ad-hoc values across `features/` (0.4, 0.45, 0.5, 0.55, 0.7, 0.72, 0.75,
  0.85, 0.92, 0.95).

**Prerequisite, and it is large: `apps/web` has never been linted.** Root `pnpm lint` covers
only `apps/api/src packages/domain/src packages/contracts/src`, and `apps/web`'s own lint
script is literally `echo ok` (`OUTSTANDING.md:173-178`, which warns to expect a big first-run
backlog). Scope this properly: land ESLint on `apps/web` with a baseline/ratchet so the
backlog does not block the gate, then tighten.

Also convert the `STUDIO-STYLING-AND-UX.md` §6 checklist items that are mechanically testable
into Playwright probes. "One tool dock on the idle CAD left edge" is an assertion, not a vibe.

## Phase 2 — Close the known backlog

`OUTSTANDING.md` is the punch list and it is honest. Work it, do not re-file it. Priorities:

- **`GardenViewpointStrip` and `VariationFilmstrip` double portal** (`:142-151`). Both wrap
  themselves in `CameraChrome place="dock"` after being migrated into FrameDrawers, so they
  portal back out and float on the drawing. `ArtboardStrip` had the identical bug and was fixed
  in `ebf1872`. These two were left because e2e specs assert they float. **Decide whether the
  drawers or the summoned floaters are the intended UX, then make the code and the probes
  agree.** This is the mechanical cause of part of the floating-panel problem.
- **Quote line table column crowding** (`:168-172`). `grid-template-columns: 1fr 36px 72px 84px
  108px minmax(120px,180px)` runs TOTAL and ACTIONS together with no gutter and a long unit
  note bleeds into actions. The doc is explicit that this needs a measured column pass, not a
  token swap. Deliberately left untouched so you can do it properly in one go.
- **`dashboard-filter-sort.spec.ts` is stale** (`:163-167`) — 2 of 5 tests red on a clean tree
  since the `/home` editorial redesign. Rewrite against current markup or delete the
  assertions.
- **Single API machine** (`:18-21`) — still requires a human action; surface it, don't silently
  assume it.

## Phase 3 — The AI is invisible

This is the highest-leverage product finding in the audit and it is not a bug.

The AI is real and deep: `Ask AI` / ⌘K → `useStudioState.ts:askAi` → `designAssistAction` →
`apps/api/src/routes/design-assist.ts` → `apps/api/src/lib/claude.ts` → the Anthropic Messages
API, plus a second `AUDIT_MODEL` self-audit pass. Proposals return as ghosts (`ghost: true`)
that stay ephemeral until accepted, `markStaleGhostsNearEdit` invalidates them when you edit
nearby, and `buildSessionRejectionPrompt` feeds this session's rejections back into the next
prompt. There is vision-based canopy detection over aerial imagery and sketch-to-CAD
interpretation. Eight proposal sources.

**All of it surfaces as the text "Ask AI", eighth in a row of nine undifferentiated glyphs.**

`STUDIO-STYLING-AND-UX.md` §6 item 10 already requires *"discoverable in context (hint pill on
first relevant action, Cmd+K entry, cursor affordance) instead of relying on the user noticing
a new icon."* The AI currently relies on the user noticing an icon. Fix that against the spec
that already exists.

## Phase 4 — The 3D client twin

`components/share/ClientShareTwin.tsx` (571 lines) is a real `THREE.WebGLRenderer` scene
rendered on the client-facing share page via `ClientShareDecision.tsx:92`. CSS custom
properties do not reach WebGL materials, so it is structurally excluded from every token
decision made elsewhere. It is also the surface a paying client actually looks at.

Decide explicitly: does it read as the same product as the 2D studio, or is it deliberately a
different register? If the former, it needs a token-to-material mapping and an owner. Either
way, write the decision down.

## Constraints

- **Conventional Commits**, matching the existing log (`feat(web):`, `fix(api):`,
  `chore(deploy):`). No new prefixes. **No emojis** anywhere.
- **One commit, one revertable concern.** Do not bundle a refactor with a feature.
- **pnpm only**, always from the repo root.
- **CSS Modules + CSS variables.** Do not introduce Tailwind, CSS-in-JS, or a state library —
  `CLAUDE.md` rules these out explicitly and they are not up for renegotiation.
- **Desktop-first for `apps/web`.** `apps/mobile` is a separate forked product, not a
  responsive breakpoint.
- **AU locale throughout** — en-AU, AUD, GST, ABN, Stonnington/Yarra overlays.
- **Chrome changes are e2e-locked.** 46 specs in `apps/web/e2e/`, several asserting current
  chrome: `instrument-dial`, `canvas-chrome-parenting`, `canvas-chrome-detector`,
  `canvas-lane-law`, `canvas-chrome-screenshots`. Budget probe updates into every chrome PR,
  and treat a spec that asserts current behaviour as a product decision to be raised, not an
  obstacle to route around.
- **Do not touch `canvas-contrast-aa.spec.ts` coverage.** WCAG 2.2 AA on the canvas was fixed
  (23 failures across 22 rules) and the gate is at zero. Keep it there.
- **No destructive production action** — no deploys, no secret changes, no `flyctl` — without
  explicit authorisation in the same conversation.

## How to work

Report at the end of each phase rather than running to completion. Ground every claim about
how the app behaves in a file path and line number; if you could not verify something, label
it an assumption. A list of questions you need answered is a feature of good work, not a
failure.

If discovery contradicts anything in `00-DISCOVERY.md` or in this brief, say so plainly and
make the counter-case. That document contains one documented wrong conclusion already — it was
caught by the operator, not by the author. Assume there are more.
