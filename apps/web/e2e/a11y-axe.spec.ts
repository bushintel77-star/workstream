import { expect, test, type Page } from "@playwright/test";
import axePkg from "axe-core";
import { createAddressProject } from "./helpers";

const axeSource = axePkg as { source: string };

const PID = "projects/580e";

/**
 * Accessibility gate — axe-core (WCAG 2.0/2.1 A + AA) across the operator
 * surfaces. The canvas chrome is DOM (Gold Standard layer 3), so it is fully
 * auditable: mode tabs, tool rail, glass cards, fit-sheet, utility pages.
 *
 * Known pre-existing exclusion: the classic ?svg=1 studio's paper-label
 * language carries documented contrast debt (docs/UI-PARITY-AUDIT-2026.md
 * §3) — audited separately by canvas-contrast-aa.spec.ts, not here.
 */
async function axeViolations(page: Page): Promise<string[]> {
  await page.evaluate((src) => {
    if (!document.getElementById("axe-inject")) {
      const s = document.createElement("script");
      s.id = "axe-inject";
      s.textContent = src;
      document.head.appendChild(s);
    }
  }, axeSource.source);
  return page.evaluate(async () => {
    const r = await window.axe.run(document, {
      resultTypes: ["violations"],
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    });
    return r.violations.map(
      (v) =>
        `${v.impact ?? "?"}/${v.id} ×${v.nodes.length} — ` +
        (v.nodes[0]?.target ?? []).join(" ").slice(0, 80),
    );
  });
}

test.describe("Accessibility (axe, WCAG A/AA)", () => {
  test("dashboard, canvas chrome, and utility surfaces stay violation-free", async ({
    page,
    request,
  }) => {
    test.setTimeout(150_000);
    const { projectId } = await createAddressProject(request, {
      address: "1 A11y Audit Street, Melbourne VIC 3000",
    });

    const routes: Array<[string, string]> = [
      ["dashboard", "/home"],
      ["canvas", `/projects/${projectId}`],
      ["measurements", `/projects/${projectId}/measurements`],
      ["audit", `/projects/${projectId}/audit`],
      ["settings", "/settings/license"],
    ];

    for (const [name, path] of routes) {
      await page.goto(path);
      await page.waitForTimeout(name === "canvas" ? 6000 : 1500);
      const violations = await axeViolations(page);
      expect(
        violations,
        `axe violations on ${name}:\n${violations.join("\n")}`,
      ).toEqual([]);
    }
  });
});
