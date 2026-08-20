import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";

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
  /*
   * SDS z-token enforcement — see apps/web/src/styles/globals.css
   * (--cf-z-canvas|spatial|chrome|app). Raw numeric zIndex values and
   * Tailwind z-N utilities both bypass that ladder, so they are forbidden
   * anywhere under apps/web/src. Feature modules opt into one of the four
   * named tiers; the drei `<Html zIndexRange>` ladder is documented next
   * to the CSS block for the limited set of files that still need it.
   */
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
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
          // drei `<Html zIndexRange={[N, M]}>` ladder — companion to the
          // four CSS-token restrictions above. Reaches any Literal
          // directly nested inside a `zIndexRange` JSX attribute whose
          // source form starts with a digit; numeric literals are
          // caught, string literals (the kind argument of cfZPair) are
          // ignored. Adds belt-and-suspenders against callers
          // reintroducing raw pairs in feature modules.
          selector:
            "JSXAttribute[name.name='zIndexRange'] > JSXExpressionContainer > ArrayExpression > Literal[value>0][value<1000]",
          message:
            "Raw numeric drei <Html zIndexRange={[N, M]}> pair is forbidden — reach for cfZPair('spatialLabel'|'spatialAnnotation'|'chromeChip'|'chromeZone') from apps/web/src/components/canvas/cfz.ts so the tier ladder has one source of truth.",
        },
      ],
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
);
