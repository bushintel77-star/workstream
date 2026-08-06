# Devin prompt — canvas surface a11y: focus traps, exhaustive-deps, heading/landmark audit

> Paste everything below the line into Devin.

---

## Mission

Continue the canvas-surface a11y pass (`b3ca798`, `c45facd`). Those two commits closed
every unsafe `role="button"` div. This prompt closes the three items that scan raised but
didn't fix: dialogs with no keyboard focus management, undocumented `exhaustive-deps`
suppressions, and missing heading/landmark structure. Each task below was investigated
down to file-and-line before this was written — you shouldn't need to rediscover any of
it, just verify and implement.

Work the tasks in order. Each is its own commit (or small commit group) per the standing
"one commit, one revertable concern" rule. **Commit only — do not push or deploy** without
separate, explicit authorisation in that later conversation (per
`docs/design/DEVIN-PRODUCTION-BRIEF.md`'s constraint).

## Already done — do not redo

- All 247 native `<button>` elements in `apps/web/src` have an explicit `type`.
- `PresentSurface.tsx` — `<div role="button">` → real `<button type="button">` (`b3ca798`).
- `ServicesLedger.tsx` — row restructured to an `<li>` grid with a sibling checkbox +
  `<button type="button">`, no nested interactives (`c45facd`).
- Re-verified 2026-08-05: repo-wide `grep -rn 'role="button"' apps/web/src` returns exactly
  one hit — `features/selectionFocus/SelectionFocusVeil.tsx:63`, an `<svg role="button"
  tabIndex={0} onKeyDown>`. SVG can't be a native button; this is the correct pattern.
  Leave it.

## Task 1 — Extract the focus-trap hook, wire it into five orphaned dialogs

### Context

`RightDataLane` (`apps/web/src/components/canvas/handoff/features/surfaces/DataLaneSlot.tsx`)
already implements Esc-closes / Tab-Shift+Tab-traps / focus-in-on-open /
restore-on-close correctly, and wraps 11 panels rendered from `HandoffDesignStudio.tsx`:
checklist, measures, ghosts, services, environment, site, trees, layers, image-layers,
sites, quote. That contract is locked by `apps/web/e2e/right-data-lane-keyboard.spec.ts` —
do not regress it.

Five more components render their own `role="dialog"` outside that wrapper and don't get
any of this:

| File | Current state |
|---|---|
| `features/coach/StudioCoachMarks.tsx:64` | `role="dialog"`, nothing else — no Esc, no focus move, no restore |
| `features/present/DeckInspectorDock.tsx:60` | same — bare `role="dialog"` |
| `features/fitSheet/SheetComposeDock.tsx:107` | has Esc (separate effect, lines 83–93), no trap/autofocus/restore |
| `features/share/ShareRevisionPopup.tsx:333` | has Esc gated on `!confirmOpen` (lines 172–181), no trap/autofocus/restore |
| `features/commandPalette/StudioCommandPalette.tsx:571` | has Esc + autofocus-the-search-input + Arrow/Enter nav, no Tab-trap (Tab silently escapes the dialog), no restore |

Also note, **not in scope for this task**: `apps/web/src/components/BottomDock.tsx` and
`RailDrawer.tsx` each independently hand-roll the identical Esc/trap/restore logic a
second and third time (see their own effects around focus/Escape/Tab). They already work
and are covered by their own tests — leave them alone here. Once this task lands, they're
a candidate for a follow-up consolidation onto the same hook, but don't bundle that in;
it's a separate, larger-blast-radius change.

### 1a. New file: `apps/web/src/lib/use-focus-trap.ts`

Note: this file may already exist in the tree with exactly the content below — it was
written once while drafting this handover, to confirm it typechecks against the real
component signatures, then left in place rather than fought over a filesystem lock. If
it's already there, diff it against the block below, confirm it matches, and move on;
this isn't something to clean up first, it's just step 1a done early.

Match the codebase's `@/lib/...` import-alias convention already used inside this same
`features/` tree (e.g. `@/lib/freehandPath` in `PresentSurface.tsx`, `SketchBoard.tsx`).

```ts
"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared dialog focus behavior: Esc calls `onClose`, Tab/Shift+Tab trap focus
 * inside `containerRef` while `active`, focus moves into the container when
 * it becomes active, and returns to whatever was focused before on
 * deactivate.
 *
 * Lifted out of `RightDataLane` (features/surfaces/DataLaneSlot.tsx), which
 * has used this exact implementation for the 11 panels it wraps — see
 * e2e/right-data-lane-keyboard.spec.ts for the contract this preserves.
 * Components that render their own `role="dialog"` outside that wrapper had
 * none of this; this hook lets them opt in without re-deriving it.
 */
export function useFocusTrap(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onClose?: () => void,
) {
  useEffect(() => {
    if (!active) return;
    const restore =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    // Defer past React StrictMode's dev-only double-invoke (mount → cleanup
    // → remount all happen synchronously in the same commit) so the focus
    // call lands after that churn settles, not in the middle of it.
    const raf = requestAnimationFrame(() => {
      const root = containerRef.current;
      const firstFocusable = root?.querySelector<HTMLElement>(FOCUSABLE);
      (firstFocusable ?? root)?.focus({ preventScroll: true });
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose?.();
        return;
      }
      const root = containerRef.current;
      if (e.key !== "Tab" || !root) return;
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown, true);
      restore?.focus?.({ preventScroll: true });
    };
    // containerRef is a stable ref object; onClose identity changes are
    // intentionally ignored so the trap doesn't re-bind mid-session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
```

This was written and typechecked against the real component signatures before this
handover was drafted. Per the note above, it's likely still sitting in the tree from that
verification pass — if so, that's step 1a already done, not a diff to reconcile against.
The logic is a verbatim lift of `DataLaneSlot.tsx`'s existing effect, generalized from
"always active on mount" to an explicit `active` boolean so it can be driven by each
caller's own `open` (and, for `ShareRevisionPopup`, `open && !confirmOpen`).

### 1b. Refactor `RightDataLane` to use it (pure extraction, behavior must not change)

In `DataLaneSlot.tsx`, replace the inline effect with:

```tsx
import { useRef, type ReactNode } from "react";
import { CameraChrome } from "../../CameraChrome";
import { useFocusTrap } from "@/lib/use-focus-trap";
import css from "./rightDataLane.module.css";

export function RightDataLane({
  children,
  testId = "right-data-lane",
  onClose,
}: {
  children: ReactNode;
  testId?: string;
  onClose?: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  useFocusTrap(true, rootRef, onClose);

  return (
    <CameraChrome place={{ kind: "dock" }} zIndex={52} testId={`${testId}-chrome`}>
      <div
        ref={rootRef}
        className={css.slot}
        data-testid={testId}
        data-camera-chrome-card="1"
        tabIndex={-1}
      >
        {children}
      </div>
    </CameraChrome>
  );
}
```

Run `apps/web/e2e/right-data-lane-keyboard.spec.ts` after this step specifically — it must
pass unchanged. If it doesn't, the extraction introduced a behavior difference; find it
before moving on, don't paper over it.

### 1c. Wire the five orphaned dialogs

**`StudioCoachMarks.tsx`** — mounted only while a coach step is active (`step == null`
returns null), so `active` for the hook is just "mounted." There's no `onClose`
equivalent — `finish()` is the closest analog (marks the tour seen, unmounts). Add a
`containerRef` on the outer `<div role="dialog">`, call `useFocusTrap(true, containerRef,
finish)`. `finish` is declared after the effect would run in source order but is a stable
function recreated each render — either hoist it or accept the lint on identity (it's not
in the effect's own deps per the hook's design, so this is fine either way).

**`DeckInspectorDock.tsx`** — has `open`/`onClose` props already. Add a `containerRef` on
the outer `<div role="dialog">`, call `useFocusTrap(open, containerRef, onClose)`. This is
the simplest of the five — no other keyboard logic to reconcile.

**`SheetComposeDock.tsx`** — has a "linger" auto-dismiss timer (`bumpLinger` /
`lingerRef`, closes after 4.2 s idle, reset on `onPointerEnter`) plus its own Esc effect
(lines 83–93, deps `[open, onClose]`, no suppression needed there today — it's correct as
written). Replace that Esc effect with `useFocusTrap(open, panelRef, onClose)` on the
`.peel` div (add a ref there — it doesn't have one today). Two things to get right:
1. This removes the now-redundant hand-written Esc effect; don't leave both running
   (double `onClose()` calls are harmless but sloppy).
2. The linger timer only resets on pointer activity today. Once Tab-trap makes keyboard
   navigation into this panel actually work, a keyboard user tabbing slowly through the
   theme/pen/atmosphere/template rows can get the panel yanked out from under them mid‑
   interaction while a mouse user tabbing the same speed wouldn't. Add `onFocus=
   {bumpLinger}` alongside the existing `onPointerEnter={...}` on the `.peelHost` div (or
   `.peel`) so keyboard focus also resets the timer. Small addition, directly caused by
   this change, worth doing in the same commit.

**`ShareRevisionPopup.tsx` + `SafetyWaiverConfirm.tsx`** — these compose: the popup can
open a nested `SafetyWaiverConfirm` (`role="alertdialog"`, already has `aria-modal="true"`,
`aria-labelledby`/`aria-describedby`, autofocuses Cancel, has its own Esc handler — it's
the best-implemented dialog in the codebase already). Get the layering right:
- `ShareRevisionPopup.tsx` already has `panelRef` (used for click-outside detection at
  lines 183–198, leave that effect alone) and an Esc effect at lines 172–181 gated on
  `!confirmOpen` ("the safety confirm owns Escape while it's up"). Replace that Esc effect
  with `useFocusTrap(open && !confirmOpen, panelRef, onClose)` — the same gating principle,
  now also covering Tab-trap and restore. While `confirmOpen` is true, the outer popup's
  trap must stand down or Tab could escape the (higher-priority) nested alertdialog into
  the muted popup behind it.
- `SafetyWaiverConfirm.tsx` currently has its own bespoke focus-on-open effect (lines
  34–38, focuses the Cancel button specifically) and Esc effect (lines 40–47). Add a
  `cardRef` on the `.card` div and replace both with `useFocusTrap(Boolean(disclaimer),
  cardRef, onCancel)`. Cancel is already the first focusable element inside `.card` (it
  precedes Confirm in DOM order), so the hook's generic "focus first focusable" lands on
  Cancel automatically — behavior is preserved, not just approximated. This also gives the
  alertdialog a real Tab-trap it didn't have before (today Tab could reach whatever's
  behind the scrim, since there's no `inert` and no trap — the scrim has no click-outside
  dismiss specifically because "a hard confirm is answered, not escaped past," and an
  un-trapped Tab undermines that same intent).

**`StudioCommandPalette.tsx`** — combobox pattern: text input + `role="listbox"` of
`role="option"` buttons, `aria-activedescendant` tracks a virtual `active` index, Arrow
Up/Down/Enter drive it (lines ~571–632). Keep all of that. Add a `panelRef` on the
`.panel` div, call `useFocusTrap(open, panelRef, onClose)`. Two cleanups against the
existing code once the hook is wired:
1. The panel's own `onKeyDown` has an `Escape` branch (`e.preventDefault(); onClose();`) —
   remove it, the hook now owns Escape. Keep the `ArrowDown`/`ArrowUp`/`Enter` branches
   exactly as they are.
2. The existing open-effect (`setActive(0)` + `window.setTimeout(() =>
   inputRef.current?.focus(), 0)`) resets list state *and* focuses the input. Keep the
   `setActive(0)` reset (unrelated to focus). The manual `inputRef.current?.focus()` call
   becomes redundant — the input is the first focusable element in `.panel`'s DOM order
   (it precedes the `<ul>` of option-buttons), so the hook's generic autofocus already
   lands there. Drop the redundant call, or leave it — it's the same element either way,
   just don't fight it with a different target.

### 1d. Test coverage

Add `apps/web/e2e/canvas-dialog-focus-trap.spec.ts` mirroring
`right-data-lane-keyboard.spec.ts`'s two-test shape (Escape closes; Tab/Shift+Tab stays
inside) for each of the five components above. Use the existing `data-testid`s: 
`canvas-coach-mark`, `deck-inspector-dock`, `sheet-compose-peel`, `share-revision-popup`,
`canvas-command-palette`. For `share-revision-popup`, add a third case asserting Escape
does *not* close the popup while `safety-waiver-confirm` is open (only the waiver should
respond), to lock in the nested-dialog gating from 1c.

---

## Task 2 — 17 `exhaustive-deps` suppressions

Confirmed by repo-wide search (`grep -rn 'eslint-disable.*exhaustive-deps' apps/web/src`)
on 2026-08-05: 17 total, across `HandoffDesignStudio.tsx` (9: lines 1060, 1220, 1233, 1346,
1357, 1372, 1811, 1950, 2849), `useStudioState.ts` (2: lines 2251, 3867), and one each in
`SheetComposeDock.tsx:80`, `DraftGridStudio.tsx:78`, `ShareRevisionPopup.tsx:169`,
`DataLaneSlot.tsx:75`, `ClientShareTwin.tsx:426`, `use-studio-estimate.ts:69`.

**Skip entirely:** `HandoffDesignStudio.tsx:1811` (the keyboard-shortcut effect) — already
tracked in `OUTSTANDING.md` ("`HandoffDesignStudio` keyboard-shortcut effect can go
stale"), blocked on reordering declarations in a ~5,959-line component. Don't re-log it,
don't touch it here.

**`SheetComposeDock.tsx:80` and `DataLaneSlot.tsx:75`** are handled by Task 1 — the first
disappears when you consolidate onto the shared linger-effect pattern above (verify after
1c whether the suppression is still needed once the Esc effect is removed — it may not
be), the second is fixed by extracting into `use-focus-trap.ts` (the suppression moves
there, documented once instead of copy-pasted per caller).

That leaves 14. Split by what they need:

**Document only — add a one-line reason comment, no behavior change.** These are
deliberate "run once on mount / on identity change" patterns where the omitted deps are
stable setters; the existing suppressions elsewhere in the same files already do this
(see `HandoffDesignStudio.tsx:1950`'s `-- seed once when Services opens empty` for the
style to match):
- `DraftGridStudio.tsx:78` — cleanup-only unmount effect.
- `useStudioState.ts:2251` — "once on mount" seed effect (already has a plain comment,
  just needs the `--` suffix format for consistency).
- `useStudioState.ts:3867` — already commented ("Keyed on content, not on callback
  identity...") — just needs the `--` suffix.
- `ClientShareTwin.tsx:426` — already commented ("Mount once per canvas identity...") —
  same, format only.
- `use-studio-estimate.ts:69` — already commented ("key drives refresh") — format only.
- `HandoffDesignStudio.tsx:1346`, `:1357`, `:1372`, `:1950` — project-scoped prefs-seeding
  effects, all keyed on `[projectId]` (or `[servicesOpen, ...]` for :1950) by design.
  `:1346` and `:1950` already have reason comments; add matching ones to `:1357` and
  `:1372` for consistency.

**Investigate — add the missing deps, run `pnpm test` + the closest e2e, and see what
happens. If it's genuinely fine, keep the fix. If it breaks something (stale-closure fix
causes a re-render loop, or an intentional one-time behavior becomes repeating), revert
and add a reason comment instead — but the reason has to be real, not assumed:**
- `HandoffDesignStudio.tsx:1220` — deps list `[ui.mode, ui.frameOn, ui.tiltDeg,
  clearTiltAnimKind]`; check whether `studio.setUi` (called inside, not listed) can go
  stale.
- `HandoffDesignStudio.tsx:1233` — deps `[ui.tiltDeg, ui.selectedId,
  ui.groupIds.length]`; `studio.setSelection` is called inside but not listed.
- `HandoffDesignStudio.tsx:2849` — deps `[drawingHot]` only; `ui.utilityPanel`,
  `ui.coachOpen`, and `studio.setUi` are read inside but not listed — this one reads two
  extra pieces of state inside the effect body without depending on them, which is the
  shape most likely to actually be stale.
- `ShareRevisionPopup.tsx:169` — deps `[open, projectId]`, comment says "refresh on open
  only" but doesn't explain why `projectId` specifically is safe inside a 12-second
  polling interval closure. Confirm `refresh` (called inside, not listed) doesn't capture
  a stale `projectId` if the prop changes while the popup stays open — check whether that
  can even happen (can `projectId` change without the popup remounting?) and document
  whichever answer is true instead of leaving the comment vague.

---

## Task 3 — Heading order & ARIA landmarks

Confirmed by repo-wide search on 2026-08-05. Split by risk, same as above.

### Mechanical — do now

- **Panel titles are `<p>`, not headings.** Every `role="dialog"` panel that uses the
  shared `metaCss` head pattern (`import metaCss from "../stickyMeta/metaPanel.module.css"`)
  renders its title as `<p className={metaCss.title}>` instead of a heading element, so
  screen-reader users navigating by heading list (NVDA/JAWS "H" key) find nothing for any
  of them. `QuoteBuilder.tsx:98`, `ShareRevisionPopup.tsx:338`, `ShareSurface.tsx:47,67`,
  and `SafetyWaiverConfirm.tsx:62` already use real `<h1>`/`<h2>` — match that pattern.
  Change `<p className={metaCss.title}>` → `<h2 className={metaCss.title}>` (class stays
  the same, so no visual change — verify against `canvas-contrast-aa.spec.ts` and any
  visual-regression spec anyway) in at least `ServicesLedger.tsx`, `EnvironmentPanel.tsx`,
  `SiteMetaPanel.tsx`, `TreesMetaPanel.tsx` — grep `metaCss.title` across `features/` to
  find every instance, this list may not be exhaustive. Also give `StudioCoachMarks.tsx:67`
  (`<p className={css.title}>`) and `DeckInspectorDock.tsx:64` (`<span
  className={css.dockTitle}>`) real headings while you're in those files for Task 1.

  **`LayersPanel.tsx:67`** does *not* use the shared `metaCss` module — confirmed by
  reading the file directly rather than assumed from the pattern above. Its `.head` div
  (line 66) contains exactly one label, `<p className={css.kicker}>Layers</p>`, in its own
  local stylesheet under its own class name — nothing else to preserve in that div. Same
  fix regardless of the different class name: `<p className={css.kicker}>Layers</p>` →
  `<h2 className={css.kicker}>Layers</h2>`. Don't skip it and don't add a second, hidden
  heading alongside it — the "kicker" name is just this file's own naming choice, the text
  plays the same role as `metaCss.title` does elsewhere.
- **`MarginStrip.tsx:54`** uses `role="contentinfo"` on a board-bottom action strip
  (history/state/actions/hint/stamp/legal). `contentinfo` is a page-level landmark meant
  for footer/copyright content once per page; this is a component-scoped strip that
  already has a correct `aria-label="Board margin"`. Change `role="contentinfo"` →
  `role="region"` (keep the existing `aria-label` — that's what makes it a *named* region,
  which is the actual fix). One-line change, low risk.

### Needs product/design sign-off — log to `OUTSTANDING.md`, do not implement blind

- **`CompactModeNav.tsx` mode-switcher uses `role="menu"`/`role="menuitem"`** (lines
  65–73) for its overflow tray. That ARIA pattern promises arrow-key roving, Home/End, and
  typeahead — none of which this widget implements (its only extra keyboard handling is a
  pointerdown-outside-close effect). A screen reader announces "menu" and sets user
  expectations this doesn't meet, which is arguably worse than no role. Compare with the
  full-width mode switcher in `HandoffDesignStudio.tsx:3468`, which correctly uses `<nav>`
  with plain buttons and `aria-current="page"` — the same control has two different (and
  differently wrong) semantics depending on viewport width. Fixing this means picking a
  real pattern (tablist/tab with `aria-selected`, or a correctly-behaved menu with arrow
  keys implemented) — that's a UX call, not a mechanical annotation swap. Log it, don't
  guess.
- **`Tier1TopBar.tsx`** (the studio's top chrome) has no `role="banner"` / `<header>` — 
  plain `<div>` zones (`zoneLeft`/`zoneCenter`/`zoneRight`). This file is very likely
  covered by the chrome-lock e2e specs (`canvas-chrome-parenting.spec.ts`,
  `canvas-chrome-detector.spec.ts`, `canvas-chrome-screenshots.spec.ts`,
  `canvas-lane-law.spec.ts` — confirm which ones actually touch it before assuming any of
  them do). A wrapping landmark element could shift DOM structure those specs depend on.
  Check those specs first; if they don't constrain this, it's a safe one-line add
  (`role="banner"` on the existing root div costs nothing structurally). If they do
  constrain it, log it instead of forcing a chrome-spec update in this batch.
  the wrong tool here.
- **Exactly one `<main>` landmark in the entire canvas surface**, and it's scoped inside
  `QuoteBuilder.tsx:147`, not the primary drawing/CAD board. The thing people spend most
  of their time in has no landmark at all. This is a real product question — what *is*
  the primary landmark for a canvas-first app where the "main content" is a drawing
  surface, not a document? — not something to answer unilaterally in a chore commit. Log
  it for product/design.

---

## Gates (binding, every commit in this batch)

- `pnpm typecheck` and `pnpm lint` (root — covers `apps/api/src apps/web/src
  packages/domain/src packages/contracts/src` at `--max-warnings 0`) must be clean.
- `pnpm test` must pass.
- Run `apps/web/e2e/right-data-lane-keyboard.spec.ts` after Task 1b specifically (must be
  unchanged), plus the new `canvas-dialog-focus-trap.spec.ts` from 1d.
- Before touching `Tier1TopBar.tsx`: run `canvas-chrome-parenting.spec.ts`,
  `canvas-chrome-detector.spec.ts`, `canvas-chrome-screenshots.spec.ts`, and
  `canvas-lane-law.spec.ts` to see which actually assert on it.
- `canvas-contrast-aa.spec.ts` must stay at zero failures — don't touch its coverage,
  per the standing constraint in `docs/design/DEVIN-PRODUCTION-BRIEF.md`.
- Conventional Commits matching the existing log (`fix(web):`, `chore(web):` — no new
  prefixes). No emojis anywhere. One commit per concern: Task 1 (hook + 5 wire-ups) can be
  one commit if done together, or split per-component if that's cleaner to review; Task 2
  and Task 3's mechanical items are each their own commit; the two "needs sign-off" items
  in Task 3 are `OUTSTANDING.md` entries only, no code commit.
- pnpm only, from repo root.

## Report back

For each task: what you changed (files + one-line summary), what you verified it against,
and the commit SHA. For Task 2, say explicitly which of the 14 items you documented-only
vs. actually fixed, and for anything you fixed, what the stale-closure risk actually was
(not just "added the dep and tests still pass" — say what would have gone wrong without
it). For Task 3's two sign-off items, confirm the `OUTSTANDING.md` entries are in and stop
there — do not implement a fix for either without separate direction. If anything in this
prompt turns out to be wrong when you check it against the live tree, say so plainly and
make the counter-case, the same as you would for `00-DISCOVERY.md`.
