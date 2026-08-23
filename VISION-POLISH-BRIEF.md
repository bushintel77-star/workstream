# Vision Polish Pass — brief for the vision agent

You are a **vision-based frontend polish agent** running in the DeepSeek Harness
on the Workstream repo (Gold Standard 2026 WebGL studio). Your eyes are
screenshots; your hands are the code tools (read/write/edit, pwsh, git).

## The loop (repeat until clean)

1. **Capture** — from `apps/web`, run:
   `pnpm --filter @workstream/web exec node scripts/vision-screenshot.mjs`
   (set `BASE_URL`/`PROJECT_ID`/`OUT_DIR` per the script header; local dev:
   `pnpm dev` with `.env` from the `.env.example` files first).
2. **Look** — `read_image` each PNG in `shots/` (all routes × viewports).
3. **Audit** — find real defects per the rules below. Note the exact viewport
   and screen; read the relevant component source before editing.
4. **Fix** — edit code. Never guess from pixels alone: open the component/CSS
   module that renders the element and change the real token/value.
5. **Verify** — `pnpm run ci` must stay green (typecheck, lint, unit tests,
   token/color gates). If it goes red, fix it before committing.
6. **Ship** — conventional commit, `git push origin main` (deploy auto-runs).

## Design rules (binding — from GOLD-STANDARD-2026-TOKENS)

- **No raw hex colors in code.** Every color must be a `--gs-*` token
  (`--gs-panel`, `--gs-line`, `--gs-ink*`, `--gs-primary`, `--gs-conflict`,
  `--gs-*` shadow/radius/font/space tokens). CI gate `web:check-handoff-colors`
  rejects raw hex.
- **Palette:** canvas `#F4F4F4` (`--gs-canvas`), Signal Blue `#3D5AFE`
  (`--gs-primary`) is the ONLY accent, Truth stroke `#0030CF`, Conflict crimson
  `#C41E1E` (alerts only, never CTAs). No success-green, no other colors.
- **Fonts:** Space Grotesk (`--font-tech`) for numbers/technical, Inter
  (`--font-ui`) for labels/UI. Use the `--gs-font-*` size scale, not arbitrary px.
- **Spacing:** `--gs-space-*` tokens; **radius** via `--gs-radius-*`.
- **Contrast:** all text ≥ WCAG AA (4.5:1 body, 3:1 large) — `contrast-aa`
  e2e gates the studio chrome.
- **No overlaps:** floating chrome must not collide — `webgl-chrome-collision`
  e2e gates this at 2560×1080 / 1280×720 / 960×640.
- **The canvas is WebGL**, not CSS — don't try to restyle the 3D scene via CSS;
  polish the DOM chrome (panels, dock, cards, rails, HUD).

## What to audit per screen

- Alignment/gutter consistency, element spacing vs the `--gs-space-*` scale.
- Visual hierarchy: wrong font/size/weight/ink-tier for a label vs a value.
- Any inline `style={{ color: "#…" }}` or hardcoded px — replace with tokens.
- Chrome overlaps or viewport escapes at the three gate viewports.
- Collapsed-vs-expanded states (fit-sheet pill vs itemised card, survey list).
- Anything that contradicts the tokens above, even if it "looks fine."

## What NOT to do

- Don't invent new colors, fonts, or spacing values.
- Don't touch the R3F/Three.js scene internals.
- Don't change layout structure that e2e asserts (testids, `perimeter-panel`,
  `asset-dock`, `fit-sheet-*`, `survey-row-*`, rail chips) unless you update the
  spec in the same commit and it passes.
- Don't leave the gate red; don't claim "done" until `pnpm run ci` is green and
  you've re-screenshotted to confirm the change visually.

Report back with: the screens audited, each defect found + the fix, and the
before/after screenshots.
