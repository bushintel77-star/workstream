import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { PaletteWidget } from "./PaletteWidget";
import { useStudioStore } from "./studioStore";

/**
 * Widget B render contract, against the INITIAL store state — the repo's
 * static-render idiom (zustand v5 serves getInitialState() to SSR, so a
 * static render always shows the fresh-session state; the interactive
 * recents/swap/contrast logic is asserted on the store itself in
 * studioStoreTier1.test.ts).
 */
function render(): string {
  return renderToStaticMarkup(createElement(PaletteWidget));
}

describe("<PaletteWidget> — Tier-1 Widget B", () => {
  it("renders the four canonical groups and the active well", () => {
    const html = render();
    expect(html).toContain("Softscape");
    expect(html).toContain("Hardscape");
    expect(html).toContain("Soil / water");
    expect(html).toContain("Markup");
    expect(html).toContain('data-testid="palette-swap"');
  });

  it("opens on a fresh session with the nib colour, no swap and no number yet", () => {
    const initial = useStudioStore.getInitialState();
    expect(initial.activeMaterialId).toBeNull();
    const html = render();
    // The well is disabled: there is no previous material to swap to.
    expect(html).toContain("disabled");
    // No material armed → the readout would be a fake number; it is absent.
    expect(html).not.toContain('data-testid="contrast-readout"');
    // No session history → no recent row.
    expect(html).not.toContain('data-testid="recent-row"');
  });

  it("keeps the 21-material canon intact in the markup", () => {
    const html = render();
    // Every canonical material id renders exactly one swatch.
    for (const id of [
      "moss", "sage", "olive", "chartreuse", "fern", "silver-foliage",
      "corten", "bluestone", "sandstone", "terracotta", "asphalt", "concrete",
      "water", "gravel", "mulch", "decomposed-granite",
      "setback", "gas", "services", "survey", "drafting",
    ]) {
      expect(html).toContain(`data-material-id="${id}"`);
    }
    // Semantic markup materials carry the semantic flag (dash signature).
    expect(html).toMatch(/data-material-id="setback"[^>]*data-semantic="true"/);
    expect(html).not.toMatch(/data-material-id="drafting"[^>]*data-semantic="true"/);
  });
});
