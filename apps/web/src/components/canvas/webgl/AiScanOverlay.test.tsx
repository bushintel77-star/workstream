import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { AiScanOverlay } from "./AiScanOverlay";

describe("<AiScanOverlay> AI parsing-stage overlay", () => {
  it("renders nothing when inactive (mount cost: null)", () => {
    const html = renderToStaticMarkup(
      createElement(AiScanOverlay, { active: false, label: "Idle" }),
    );
    expect(html).toBe("");
  });

  it("active with stages: one status live region, stage texts, decorative layers aria-hidden", () => {
    const html = renderToStaticMarkup(
      createElement(AiScanOverlay, {
        active: true,
        label: "AI drafting ghosts",
        stages: ["Reading lot geometry", "Segmenting canopy", "Drafting proposals"],
        testId: "ai-scan-overlay-draft",
      }),
    );
    expect(html).toContain('data-testid="ai-scan-overlay-draft"');
    // Exactly the announced contract: one role=status, polite live region.
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect((html.match(/role="status"/g) ?? []).length).toBe(1);
    // Every stage label reaches the DOM (the operator reads WHAT runs).
    expect(html).toContain("Reading lot geometry");
    expect(html).toContain("Segmenting canopy");
    expect(html).toContain("Drafting proposals");
    // Decorative phases (veil, reveal, beam, pulse dot) are never announced.
    expect((html.match(/aria-hidden/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it("active without stages: the label itself is the announced status line", () => {
    const html = renderToStaticMarkup(
      createElement(AiScanOverlay, { active: true, label: "Importing site truth" }),
    );
    expect(html).toContain('data-testid="ai-scan-overlay"');
    expect(html).toContain("Importing site truth");
    expect(html).toContain('role="status"');
    // Stage track stays absent — no fabricated stages (zero-mock law). Its
    // unique marker is the --scan-cycle custom property (stage branch only).
    expect(html).not.toContain("--scan-cycle");
  });
});
