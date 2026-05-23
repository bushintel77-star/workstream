import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/**/*.{test,spec}.ts",
      "apps/api/**/*.{test,spec}.ts",
      "apps/web/src/**/*.{test,spec}.ts",
    ],
    exclude: ["**/node_modules/**", "**/dist/**", "apps/mobile/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "packages/domain/src/**",
        "apps/api/src/lib/**",
      ],
      exclude: ["**/*.test.ts", "**/*.spec.ts", "**/dist/**"],
    },
  },
});
