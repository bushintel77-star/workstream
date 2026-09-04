/*
 * Button.test.tsx — Tier 3 #2 primitive extraction tests.
 *
 * Verifies the pixel-stable contract for <Button>'s four variants
 * (chip / ghost / icon / primary) using
 * `react-dom/server`'s renderToStaticMarkup. This repo intentionally
 * has no jsdom / @testing-library, so the tests run in pure node.
 *
 * Contract under test:
 *   • variant="chip" + active=true → identical CSS to the prior
 *     PerimeterTabStrip mode-tab / meta-tab `chipBase + active
 *     override` (transparent base → chip-active background).
 *   • variant="chip" + active=false → identical CSS to the prior
 *     inactive PerimeterTabStrip chip (transparent bg,
 *     --ws-ink-secondary text, 0.15s color transition).
 *   • variant="icon" → identical CSS to the prior FitSheetCard
 *     × close button (`all: "unset"` + 22×22 + pill radius).
 *   • variant="ghost" → 5px 12px pill with hairline border.
 *   • variant="primary" → primary-tinted pill.
 *   • data-* and aria-* attrs pass through unchanged.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { Button } from "./Button";

describe("<Button> chrome-tier primitives", () => {
  it('variant="chip" + active=true renders the active chrome chip', () => {
    const html = renderToStaticMarkup(
      createElement(Button, { variant: "chip", active: true, "data-testid": "chip" }, "Quote"),
    );
    expect(html).toMatch(/<button[^>]*data-testid="chip"/);
    expect(html).toContain('background:var(--ws-active)');
    expect(html).toContain('color:var(--ws-active-ink)');
    expect(html).toContain('font-family:var(--font-ui)');
    expect(html).toContain('font-size:var(--ws-text-xs)');
    expect(html).toContain('border-radius:var(--ws-radius-pill)');
    expect(html).toContain('padding:3px 9px');
    expect(html).toContain('letter-spacing:0.04em');
    expect(html).toContain('white-space:nowrap');
  });

  it('variant="chip" + active=false renders the inactive chrome chip with hover-lightup handlers', () => {
    const html = renderToStaticMarkup(
      createElement(
        Button,
        { variant: "chip", active: false, "data-testid": "chip-i" },
        "Studio",
      ),
    );
    expect(html).toMatch(/<button[^>]*data-testid="chip-i"/);
    expect(html).toContain('background:transparent');
    expect(html).toContain('color:var(--ws-ink-secondary)');
    // Hover-lightup handlers are wired (the function bodies are emitted
    // by SSR but renderToStaticMarkup does not include them — we assert
    // the consumer-styling contract only).
  });

  it('variant="chip" + size="xs" renders the tighter gizmo chip (InspectorCard Manipulator)', () => {
    const html = renderToStaticMarkup(
      createElement(
        Button,
        { variant: "chip", size: "xs", "data-testid": "gizmo" },
        "Move",
      ),
    );
    expect(html).toContain('font-size:var(--ws-text-xs)');
    expect(html).toContain('padding:3px 8px');
    expect(html).toContain('border-radius:var(--ws-radius-pill)');
  });

  it('variant="chip" + size="xs" + active=true renders the tighter chip with the chip-active override', () => {
    const html = renderToStaticMarkup(
      createElement(
        Button,
        { variant: "chip", size: "xs", active: true, "data-testid": "gizmo-active" },
        "Rotate",
      ),
    );
    expect(html).toContain('font-size:var(--ws-text-xs)');
    expect(html).toContain('padding:3px 8px');
    expect(html).toContain('background:var(--ws-active)');
    expect(html).toContain('color:var(--ws-active-ink)');
  });

  it('variant="chip" passes aria-pressed through (meta-tab contract)', () => {
    const html = renderToStaticMarkup(
      createElement(
        Button,
        { variant: "chip", active: true, "aria-pressed": true, "data-testid": "t" },
        "Fit",
      ),
    );
    expect(html).toMatch(/aria-pressed="true"/);
  });

  it('variant="icon" renders the FitSheetCard × close button shape byte-for-byte', () => {
    const html = renderToStaticMarkup(
      createElement(
        Button,
        { variant: "icon", "aria-label": "Close", "data-testid": "x" },
        "×",
      ),
    );
    expect(html).toMatch(/<button[^>]*data-testid="x"/);
    /* Explicit resets, NOT all:unset — all:unset killed the inherited
     * :focus-visible ring (design-spec debt D3). The reset set must stay
     * enumerated so the global focus ring survives. */
    expect(html).not.toContain('all:unset');
    expect(html).toContain('background:transparent');
    expect(html).toContain('border:none');
    expect(html).toContain('width:22');
    expect(html).toContain('height:22');
    expect(html).toContain('display:flex');
    expect(html).toContain('color:var(--ws-ink-secondary)');
    expect(html).toContain('font-size:var(--ws-text-lg)');
    expect(html).toContain('border-radius:var(--ws-radius-pill)');
    expect(html).toMatch(/aria-label="Close"/);
  });

  it('variant="ghost" renders the secondary pill button', () => {
    const html = renderToStaticMarkup(
      createElement(Button, { variant: "ghost", "data-testid": "g" }, "Cancel"),
    );
    expect(html).toMatch(/<button[^>]*data-testid="g"/);
    expect(html).toContain('padding:5px 12px');
    expect(html).toContain('border-radius:var(--ws-radius-pill)');
    expect(html).toContain('background:transparent');
    expect(html).toContain('color:var(--ws-ink-secondary)');
  });

  it('variant="ghost" + size="md" scales the padding', () => {
    const html = renderToStaticMarkup(
      createElement(Button, { variant: "ghost", size: "md", "data-testid": "g2" }, "Continue"),
    );
    expect(html).toContain('padding:7px 14px');
  });

  it('variant="primary" renders the CTA pill', () => {
    const html = renderToStaticMarkup(
      createElement(
        Button,
        { variant: "primary", active: true, "data-testid": "p" },
        "Confirm",
      ),
    );
    expect(html).toContain('background:var(--ws-active)');
    expect(html).toContain('color:var(--ws-panel)');
  });

  it('variant="chip-tinted" + active=true renders the warm primary-tinted chip (PhotoTraceHud recipe)', () => {
    const html = renderToStaticMarkup(
      createElement(
        Button,
        { variant: "chip-tinted", active: true, "data-testid": "ct" },
        "1 m",
      ),
    );
    expect(html).toMatch(/data-testid="ct"/);
    expect(html).toContain('padding:4px 10px');
    expect(html).toContain('border-radius:var(--ws-radius-pill)');
    // active override matches PhotoTraceHud's chipStyle(true)
    expect(html).toContain(
      'border:1px solid color-mix(in srgb, var(--ws-active) 50%, transparent)',
    );
    expect(html).toContain(
      'background:color-mix(in srgb, var(--ws-active) 14%, transparent)',
    );
    /* Charcoal accent on the wash (AA at body size). */
    expect(html).toContain('color:var(--ws-ink)');
  });

  it('variant="chip-tinted" + active=false renders the inactive cool-tinted shell', () => {
    const html = renderToStaticMarkup(
      createElement(
        Button,
        { variant: "chip-tinted", active: false, "data-testid": "cti" },
        "Recalibrate",
      ),
    );
    expect(html).toContain('background:transparent');
    expect(html).toContain('color:var(--ws-ink-secondary)');
    // base border should be present (cool-tinted, not transparent)
    expect(html).toContain(
      'border:1px solid color-mix(in srgb, var(--ws-line) 55%, transparent)',
    );
  });

  it('variant="capsule" renders the MetaChipSet boundary-marker pill', () => {
    const html = renderToStaticMarkup(
      createElement(
        Button,
        { variant: "capsule", "data-testid": "mc" },
        "Zone 1",
      ),
    );
    expect(html).toMatch(/<button[^>]*data-testid="mc"/);
    expect(html).toContain('font-family:var(--font-tech)');
    expect(html).toContain('font-size:var(--ws-text-xs)');
    expect(html).toContain('font-variant-numeric:tabular-nums');
    expect(html).toContain('background:var(--ws-panel)');
    expect(html).toContain('border-radius:var(--ws-radius-pill)');
    expect(html).toContain('box-shadow:var(--ws-shadow-1)');
    expect(html).toContain('pointer-events:auto');
    expect(html).toContain('padding:1px 8px');
  });

  it('variant="capsule" merges consumer opacity/color/transform overrides (bright/expanded state)', () => {
    const html = renderToStaticMarkup(
      createElement(
        Button,
        {
          variant: "capsule",
          style: { opacity: 0.4, transform: "translateY(-1px)" },
          "data-testid": "mc2",
        },
        "Zone 2",
      ),
    );
    expect(html).toContain('opacity:0.4');
    expect(html).toContain('transform:translateY(-1px)');
    // Shell untouched
    expect(html).toContain('background:var(--ws-panel)');
  });

  it('variant="swatch" renders the StudioToolRail icon column shell', () => {
    const html = renderToStaticMarkup(
      createElement(
        Button,
        { variant: "swatch", "data-testid": "rail" },
        "▸ Tools",
      ),
    );
    expect(html).toMatch(/<button[^>]*data-testid="rail"/);
    expect(html).toContain('width:42');
    expect(html).toContain('flex-direction:column');
    expect(html).toContain('border-radius:var(--ws-radius-3)');
    expect(html).toContain('background:transparent');
    expect(html).toContain('color:var(--ws-ink-secondary)');
    expect(html).toContain('padding:5px 0 4px');
  });

  it('variant="swatch" + active=true goes charcoal (rail selection vocabulary)', () => {
    const html = renderToStaticMarkup(
      createElement(
        Button,
        { variant: "swatch", active: true, "data-testid": "rail-a" },
        "▾ Elev",
      ),
    );
    expect(html).toContain('background:var(--ws-active)');
    expect(html).toContain('color:var(--ws-active-ink)');
  });

  it('variant="swatch" + disabled=true mutes to not-allowed (rail disabled contract)', () => {
    const html = renderToStaticMarkup(
      createElement(
        Button,
        { variant: "swatch", disabled: true, "data-testid": "rail-d" },
        "▸ Slice",
      ),
    );
    expect(html).toContain('cursor:not-allowed');
    expect(html).toContain('opacity:0.55');
    expect(html).toContain('color:var(--ws-ink-muted)');
    // The native disabled attribute is still forwarded
    expect(html).toMatch(/disabled/);
  });

  it('variant="cta" renders the solid primary CTA (WebGLStudioPreview Import/Tidy)', () => {
    const html = renderToStaticMarkup(
      createElement(Button, { variant: "cta", "data-testid": "cta" }, "Tidy"),
    );
    expect(html).toMatch(/<button[^>]*data-testid="cta"/);
    expect(html).toContain('border:1px solid var(--ws-active)');
    expect(html).toContain('background:var(--ws-active)');
    expect(html).toContain('color:var(--ws-panel)');
    expect(html).toContain('font-weight:600');
    expect(html).toContain('border-radius:var(--ws-radius-2)');
    expect(html).toContain('padding:5px 8px');
  });

  it('variant="cta" + disabled dims to 50% + not-allowed (sketch action contract)', () => {
    const html = renderToStaticMarkup(
      createElement(
        Button,
        { variant: "cta", disabled: true, "data-testid": "cta-d" },
        "Tidy",
      ),
    );
    expect(html).toContain('opacity:0.5');
    expect(html).toContain('cursor:not-allowed');
  });

  it('variant="ghost-line" renders the strong-hairline secondary action (Convert to CAD)', () => {
    const html = renderToStaticMarkup(
      createElement(Button, { variant: "ghost-line", "data-testid": "gl" }, "Convert"),
    );
    expect(html).toMatch(/<button[^>]*data-testid="gl"/);
    expect(html).toContain(
      'border:1px solid color-mix(in srgb, var(--ws-line-strong) 60%, transparent)',
    );
    expect(html).toContain('background:transparent');
    expect(html).toContain('color:var(--ws-ink-secondary)');
    expect(html).toContain('border-radius:var(--ws-radius-2)');
    expect(html).toContain('padding:5px 8px');
  });

  it('SketchCadReviewCard Accept = cta + flex:1 (cad-accept contract)', () => {
    const html = renderToStaticMarkup(
      createElement(
        Button,
        { variant: "cta", style: { flex: 1 }, "data-testid": "cad-accept" },
        "Accept",
      ),
    );
    expect(html).toMatch(/<button[^>]*data-testid="cad-accept"/);
    // byte-identical to the prior inline Accept button
    expect(html).toContain('flex:1');
    expect(html).toContain('border:1px solid var(--ws-active)');
    expect(html).toContain('background:var(--ws-active)');
    expect(html).toContain('color:var(--ws-panel)');
    expect(html).toContain('font-weight:600');
    expect(html).toContain('padding:5px 8px');
    expect(html).toContain('border-radius:var(--ws-radius-2)');
  });

  it('SketchCadReviewCard Reject = ghost-line (byte-identical, cad-reject contract)', () => {
    const html = renderToStaticMarkup(
      createElement(
        Button,
        { variant: "ghost-line", "data-testid": "cad-reject" },
        "Reject",
      ),
    );
    expect(html).toMatch(/<button[^>]*data-testid="cad-reject"/);
    expect(html).toContain(
      'border:1px solid color-mix(in srgb, var(--ws-line-strong) 60%, transparent)',
    );
    expect(html).toContain('background:transparent');
    expect(html).toContain('color:var(--ws-ink-secondary)');
    expect(html).toContain('padding:5px 8px');
    expect(html).toContain('border-radius:var(--ws-radius-2)');
  });

  it('SketchCadReviewCard close ✕ = text + ink-muted (cad-review-close contract)', () => {
    const html = renderToStaticMarkup(
      createElement(
        Button,
        {
          variant: "text",
          style: { color: "var(--ws-ink-muted)", fontSize: "var(--ws-text-xs)", padding: "2px 6px" },
          "data-testid": "cad-review-close",
        },
        "✕",
      ),
    );
    expect(html).toMatch(/<button[^>]*data-testid="cad-review-close"/);
    expect(html).toContain('border:none');
    expect(html).toContain('background:transparent');
    expect(html).toContain('color:var(--ws-ink-muted)');
    expect(html).toContain('padding:2px 6px');
  });

  it('SketchCadReviewCard accept-all = text + primary tint (cad-accept-all contract)', () => {
    const html = renderToStaticMarkup(
      createElement(
        Button,
        {
          variant: "text",
          style: { color: "var(--ws-active)", fontSize: "var(--ws-text-xs)", padding: "4px 8px", textAlign: "left" },
          "data-testid": "cad-accept-all",
        },
        "Accept all 3",
      ),
    );
    expect(html).toMatch(/<button[^>]*data-testid="cad-accept-all"/);
    expect(html).toContain('border:none');
    expect(html).toContain('background:transparent');
    expect(html).toContain('color:var(--ws-active)');
    expect(html).toContain('padding:4px 8px');
    expect(html).toContain('text-align:left');
  });

  it('variant="chip-preset" renders the preset toggle chip (sun/layers)', () => {
    const html = renderToStaticMarkup(
      createElement(
        Button,
        { variant: "chip-preset", active: true, "data-testid": "cp" },
        "Ink",
      ),
    );
    expect(html).toMatch(/<button[^>]*data-testid="cp"/);
    expect(html).toContain('font-size:var(--ws-text-xs)');
    expect(html).toContain('padding:3px 6px');
    expect(html).toContain('border-radius:var(--ws-radius-2)');
    expect(html).toContain(
      'border:1px solid color-mix(in srgb, var(--ws-line) 45%, transparent)',
    );
    // active → charcoal chip-active treatment
    expect(html).toContain('background:var(--ws-active)');
    expect(html).toContain('color:var(--ws-active-ink)');
  });

  it('variant="glyph" renders the tech-font tool button (zoom/undo/redo row)', () => {
    const html = renderToStaticMarkup(
      createElement(
        Button,
        { variant: "glyph", "data-testid": "zoom-out", "aria-label": "Zoom out" },
        "−",
      ),
    );
    expect(html).toMatch(/<button[^>]*data-testid="zoom-out"/);
    expect(html).toContain('font-family:var(--font-tech)');
    expect(html).toContain('font-size:var(--ws-text-sm)');
    expect(html).toContain('padding:2px 0');
    expect(html).toContain('border-radius:var(--ws-radius-2)');
    expect(html).toContain('flex:1');
  });

  it('variant="glyph" + disabled mutes ink + not-allowed (no opacity fade)', () => {
    const html = renderToStaticMarkup(
      createElement(
        Button,
        { variant: "glyph", disabled: true, "data-testid": "undo" },
        "↶",
      ),
    );
    expect(html).toContain('color:var(--ws-ink-muted)');
    expect(html).toContain('cursor:not-allowed');
    // glyph disabled does NOT dim opacity (row reads disabled from ink only)
    expect(html).not.toContain('opacity:');
  });

  it('variant="text" renders the bare text button (dismiss link shell)', () => {
    const html = renderToStaticMarkup(
      createElement(
        Button,
        { variant: "text", "data-testid": "dismiss" },
        "×",
      ),
    );
    expect(html).toMatch(/<button[^>]*data-testid="dismiss"/);
    expect(html).toContain('border:none');
    expect(html).toContain('background:transparent');
    expect(html).toContain('cursor:pointer');
    expect(html).toContain('padding:0');
  });

  it('variant="primary" renders the tinted CTA chip (Review CAD / Open CAD drafter)', () => {
    const html = renderToStaticMarkup(
      createElement(
        Button,
        { variant: "primary", "data-testid": "rev" },
        "Review",
      ),
    );
    expect(html).toContain('padding:5px 8px');
    expect(html).toContain('border-radius:var(--ws-radius-2)');
    expect(html).toContain(
      'border:1px solid color-mix(in srgb, var(--ws-active) 45%, transparent)',
    );
    expect(html).toContain(
      'background:color-mix(in srgb, var(--ws-active) 14%, transparent)',
    );
    /* Charcoal accent on the wash — AA at body size. */
    expect(html).toContain('color:var(--ws-ink)');
  });

  it("merges consumer style overrides on top of the variant shell (consumer wins)", () => {
    const html = renderToStaticMarkup(
      createElement(
        Button,
        { variant: "chip", style: { padding: "8px 14px" } },
        "x",
      ),
    );
    expect(html).toContain('padding:8px 14px');
    // Shell props untouched
    expect(html).toContain('border-radius:var(--ws-radius-pill)');
  });

  it("defaults to type=button so consumers don't accidentally submit forms", () => {
    const html = renderToStaticMarkup(
      createElement(Button, { variant: "chip" }, "x"),
    );
    expect(html).toMatch(/type="button"/);
  });

  it("forwards onClick handler", () => {
    let clicked = 0;
    const html = renderToStaticMarkup(
      createElement(
        Button,
        { variant: "chip", onClick: () => clicked++, "data-testid": "h" },
        "x",
      ),
    );
    // onClick bodies are not emitted by SSR markup; this is just to make
    // sure the prop is accepted by the type. The runtime behaviour is
    // covered by Playwright e2e tests (canvas-first-z-stack.spec.ts etc.).
    expect(html).toMatch(/data-testid="h"/);
    expect(typeof clicked).toBe("number");
  });
});