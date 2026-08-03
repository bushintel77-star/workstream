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
   * global would run 17 hook rules over Fastify routes and Zod schemas for no
   * benefit.
   *
   * `eslint-plugin-react-hooks` v7 is not the old two-rule plugin: its
   * recommended set includes the React Compiler correctness rules
   * (set-state-in-effect, refs, immutability, purity, preserve-manual-
   * memoization). We enforce the full set deliberately. `configs.flat` is the
   * flat-config namespace; `configs.recommended` at the top level is still
   * eslintrc format and will not load here.
   */
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat["recommended-latest"]],
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      /*
       * App Router only — there is no `pages/` directory, and the rule warns on
       * every run when it cannot find one.
       */
      "@next/next/no-html-link-for-pages": "off",
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
