import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";

/*
 * `no-restricted-syntax` selectors are declared here as named sets and spread
 * into the config blocks below, because **ESLint flat config replaces
 * same-named rule options rather than merging them**. Two blocks whose `files`
 * globs overlap and that both configure `no-restricted-syntax` do not combine:
 * the later one wins outright.
 *
 * That is not theoretical. From the day the UI-scale block was added until
 * 2026-08-22 it silently deleted every z-token selector for
 * `apps/web/src/components/canvas/**` — the one surface the z-ladder exists to
 * protect. `eslint --print-config` on a canvas file resolved 4 selectors, all
 * UI-scale; the four z-token ones were simply absent, so the WebGL studio could
 * take a raw `zIndex: 9999` with a green lint. Combined with the CSS ratchet's
 * blindness to inline styles (it walked `.css` only, and the WebGL studio
 * imports no CSS modules) the studio's z-ladder had no automated guard from
 * either direction.
 *
 * Rule for anyone adding a scoped block: if it sets `no-restricted-syntax`, it
 * must spread in every set that already applied to those files. Verify with
 * `pnpm exec eslint --print-config <a file in the new scope>` and count.
 */

/**
 * SDS z-token enforcement — see apps/web/src/styles/globals.css
 * (--cf-z-canvas|spatial|chrome|app). Raw numeric zIndex values and Tailwind
 * z-N utilities both bypass that ladder, so they are forbidden anywhere under
 * apps/web/src. Feature modules opt into one of the four named tiers; the drei
 * `<Html zIndexRange>` ladder is documented next to the CSS block for the
 * limited set of files that still need it.
 *
 * Companion reader: the `inlineZIndex` / `inlineZIndexRange` axes in
 * scripts/check-css-scales.mjs catch the same thing textually. Both are kept —
 * lint catches it on save, the ratchet catches it when a config block shadows
 * the lint.
 */
const Z_TOKEN_SELECTORS = [
  {
    selector:
      "Property[key.name='zIndex'][value.type='Literal'][value.raw=/^\\d/]",
    message:
      "Raw numeric zIndex is forbidden in apps/web — use var(--cf-z-canvas|spatial|chrome|app) so the SDS z-token ladder stays the single source of truth.",
  },
  {
    selector:
      "JSXAttribute[name.name='className'] > Literal[value=/\\bz-\\d+\\b/]",
    message:
      "Tailwind z-N utility classes bypass the SDS z-token ladder — use a CSS class that consumes var(--cf-z-*) instead.",
  },
  {
    selector:
      "CallExpression[callee.name='cfZPair'] > Literal[value!='spatialLabel'][value!='spatialAnnotation'][value!='chromeChip'][value!='chromeZone']",
    message:
      "cfZPair() only accepts one of: 'spatialLabel' | 'spatialAnnotation' | 'chromeChip' | 'chromeZone'. Adding a new kind requires (1) updating CF_Z_PAIRS in apps/web/src/components/canvas/cfz.ts, (2) documenting it in the drei `<Html zIndexRange>` ladder block of apps/web/src/styles/globals.css.",
  },
  {
    // drei `<Html zIndexRange={[N, M]}>` ladder — companion to the four CSS
    // token restrictions above. Reaches any Literal directly nested inside a
    // `zIndexRange` JSX attribute whose source form starts with a digit;
    // numeric literals are caught, string literals (the kind argument of
    // cfZPair) are ignored. Adds belt-and-suspenders against callers
    // reintroducing raw pairs in feature modules.
    selector:
      "JSXAttribute[name.name='zIndexRange'] > JSXExpressionContainer > ArrayExpression > Literal[value>0][value<1000]",
    message:
      "Raw numeric drei <Html zIndexRange={[N, M]}> pair is forbidden — reach for cfZPair('spatialLabel'|'spatialAnnotation'|'chromeChip'|'chromeZone') from apps/web/src/components/canvas/cfz.ts so the tier ladder has one source of truth.",
  },
];

/**
 * SDS UI element standards enforcement — see docs/UI-ELEMENT-STANDARDS.md.
 *
 * Canvas-only: feature modules outside canvas are free to use whatever scales
 * they decide on. The numeric scales here all have a token reference in
 * apps/web/src/styles/globals.css:
 *   --gs-radius-{xs|sm|md|lg|xl|2xl|pill}       7 rungs
 *   --gs-font-{micro|xs|sm|md|lg|sub|h3|h2|h1}  9 rungs
 *   --gs-space-{1|2|3|4|6|8|10}                 7 rungs
 *
 * Raw rgba()/rgb() is flagged because 4 dev-HUD tokens already cover all the
 * dark-surface needs, plus the named --gs-shadow / --gs-warning-amber companion
 * tokens cover the only two content-meaningful rgba usages left in the tree.
 *
 * Companion reader: apps/web/src/components/canvas/ui.scan.test.ts catches the
 * same patterns at vitest time.
 */
const UI_SCALE_SELECTORS = [
  {
    selector:
      "Property[key.name='borderRadius'][value.type='Literal'][value>0]",
    message:
      "Raw numeric borderRadius is forbidden in canvas — use var(--gs-radius-xs|sm|md|lg|xl|2xl|pill) per docs/UI-ELEMENT-STANDARDS.md §1. (literal 0 is reserved — it means \"no corner\" and is allowed.)",
  },
  {
    selector: "Property[key.name='fontSize'][value.type='Literal'][value>0]",
    message:
      "Raw numeric fontSize is forbidden in canvas — use var(--gs-font-micro|xs|sm|md|lg|sub|h3|h2|h1) per docs/UI-ELEMENT-STANDARDS.md §2.",
  },
  {
    selector: "Property[key.name='gap'][value.type='Literal'][value>0]",
    message:
      "Raw numeric gap is forbidden in canvas — use var(--gs-space-1|2|3|4|6|8|10) per docs/UI-ELEMENT-STANDARDS.md §3. (literal 0 is reserved — it means \"no gap\" and is allowed.)",
  },
  {
    selector: "Literal[value=/rgba?\\(\\s*\\d/]",
    message:
      "Raw rgba()/rgb() literal in canvas is forbidden — consume a CSS token (--cf-dark-chrome-bg, --cf-dark-panel-bg, --gs-shadow, --gs-warning-amber) per docs/UI-ELEMENT-STANDARDS.md §5.",
  },
];

/** Shared ESLint flat config — API, web, packages. */
export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "**/.turbo/**",
      "apps/mobile/**",
      "packages/ui/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  /*
   * React / Next rules are scoped to apps/web — it is the only React surface in
   * this config (apps/mobile and packages/ui are ignored above). Leaving them
   * global would run hook rules over Fastify routes and Zod schemas for no
   * benefit.
   *
   * We enable the two classic hook rules explicitly rather than extending
   * `reactHooks.configs.flat["recommended-latest"]`. That preset also turns on
   * the React Compiler correctness set (set-state-in-effect, refs, immutability,
   * purity, preserve-manual-memoization), which reports 71 additional errors in
   * the canvas components. Adopting those is real work with real regression risk
   * against the `canvas-chrome-*` specs, and gating CI behind it would have
   * delayed every other guardrail in this config.
   *
   * So: the two rules the codebase already wrote suppressions for are enforced
   * now; the compiler set is tracked as its own scoped piece of work in
   * OUTSTANDING.md. Do not silently widen this to the preset — it takes the
   * `--max-warnings 0` gate red on contact.
   */
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks, "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "error",
      "react-hooks/refs": "error",
      "react-hooks/preserve-manual-memoization": "error",
      "react-hooks/immutability": "error",
      "react-hooks/purity": "error",
      /*
       * App Router only — there is no `pages/` directory, and the rule warns on
       * every run when it cannot find one.
       */
      "@next/next/no-html-link-for-pages": "off",
      /*
       * Every `<img>` in this app renders a runtime URI: operator-uploaded image
       * layers, captured aerial tiles, share hero shots. `next/image` wants known
       * dimensions and configured remote patterns, neither of which applies to
       * user data on a canvas. Four call sites already carried inline
       * suppressions before this plugin was installed, and the remaining five are
       * the same case — nine suppressions for one rule is the rule being wrong
       * for the app, so it is decided once here instead.
       *
       * If a static marketing asset is ever added, use `next/image` for it and
       * re-scope this to the dynamic paths.
       */
      "@next/next/no-img-element": "off",
      /*
       * Fires on the Google Fonts <link> in app/layout.tsx. The rule's advice is
       * to move to `next/font`, but its premise (`pages/_document.js`) does not
       * exist under App Router. Migrating the Fraunces / Sora / IBM Plex loading
       * to `next/font` is a real change to studio typography — tracked in
       * OUTSTANDING.md, not silenced with an inline comment.
       */
      "@next/next/no-page-custom-font": "off",
    },
  },
  {
    files: ["apps/web/src/components/canvas/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
    },
  },
  /* Z-token ladder, everywhere under apps/web/src. See Z_TOKEN_SELECTORS. */
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error", ...Z_TOKEN_SELECTORS],
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  /*
   * Canvas adds the UI-scale selectors on top of the z-token ones. Both sets are
   * spread here because this block's `files` glob overlaps the one above and
   * flat config would otherwise *replace* the z-token set for exactly the
   * surface it protects — see the note at the top of this file.
   *
   * Test files (.test.ts/.test.tsx) are excluded from the UI-scale set so the
   * scan test's own quoted examples (and any future fixture) don't trip the rule
   * on themselves; they still inherit the z-token set from the block above.
   */
  {
    files: ["apps/web/src/components/canvas/**/*.ts", "apps/web/src/components/canvas/**/*.tsx"],
    ignores: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...Z_TOKEN_SELECTORS,
        ...UI_SCALE_SELECTORS,
      ],
    },
  },
);
