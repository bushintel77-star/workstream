import type { Page } from "@playwright/test";

/** Real pipeline shell — excludes Next.js loading skeleton (`aria-busy`). */
export function pipelineShell(page: Page) {
  return page.locator(
    '[data-testid="project-pipeline-shell"]:not([aria-busy="true"])',
  );
}

/** Legacy studio layout (viewport under 960px) — matches rail tabs and counts. */
export const LEGACY_STUDIO_VIEWPORT = { width: 800, height: 900 };
