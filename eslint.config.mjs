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
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
