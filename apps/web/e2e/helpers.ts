import type { Page } from "@playwright/test";

/** Legacy pipeline chrome — must stay absent on canvas-first routes. */
export function pipelineShell(page: Page) {
  return page.locator('[data-testid="project-pipeline-shell"]');
}

/** Legacy studio layout (viewport under 960px) — matches rail tabs and counts. */
export const LEGACY_STUDIO_VIEWPORT = { width: 800, height: 900 };
