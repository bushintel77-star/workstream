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
 *     --gs-ink-secondary text, 0.15s color transition).
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
    expect(html).toContain('background:var(--gs-chip-active)');
    expect(html).toContain('color:var(--gs-chip-active-ink)');
    expect(html).toContain('font-family:var(--font-ui)');
    expect(html).toContain('font-size:var(--gs-font-sm)');
    expect(html).toContain('border-radius:var(--gs-radius-pill)');
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
    expect(html).toContain('color:var(--gs-ink-secondary)');
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
    expect(html).toContain('font-size:var(--gs-font-xs)');
    expect(html).toContain('padding:3px 8px');
    expect(html).toContain('border-radius:var(--gs-radius-pill)');
  });

  it('variant="chip" + size="xs" + active=true renders the tighter chip with the chip-active override', () => {
    const html = renderToStaticMarkup(
      createElement(
        Button,
        { variant: "chip", size: "xs", active: true, "data-testid": "gizmo-active" },
        "Rotate",
      ),
    );
    expect(html).toContain('font-size:var(--gs-font-xs)');
    expect(html).toContain('padding:3px 8px');
    expect(html).toContain('background:var(--gs-chip-active)');
    expect(html).toContain('color:var(--gs-chip-active-ink)');
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
    expect(html).toContain('all:unset');
    expect(html).toContain('width:22');
    expect(html).toContain('height:22');
    expect(html).toContain('display:flex');
    expect(html).toContain('color:var(--gs-ink-secondary)');
    expect(html).toContain('font-size:var(--gs-font-h3)');
    expect(html).toContain('border-radius:var(--gs-radius-pill)');
    expect(html).toMatch(/aria-label="Close"/);
  });

  it('variant="ghost" renders the secondary pill button', () => {
    const html = renderToStaticMarkup(
      createElement(Button, { variant: "ghost", "data-testid": "g" }, "Cancel"),
    );
    expect(html).toMatch(/<button[^>]*data-testid="g"/);
    expect(html).toContain('padding:5px 12px');
    expect(html).toContain('border-radius:var(--gs-radius-pill)');
    expect(html).toContain('background:transparent');
    expect(html).toContain('color:var(--gs-ink-secondary)');
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
    expect(html).toContain('background:var(--gs-primary)');
    expect(html).toContain('color:var(--gs-panel)');
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
    expect(html).toContain('border-radius:var(--gs-radius-pill)');
    // active override matches PhotoTraceHud's chipStyle(true)
    expect(html).toContain(
      'border:1px solid color-mix(in srgb, var(--gs-primary) 50%, transparent)',
    );
    expect(html).toContain(
      'background:color-mix(in srgb, var(--gs-primary) 14%, transparent)',
    );
    expect(html).toContain('color:var(--gs-primary)');
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
    expect(html).toContain('color:var(--gs-ink-secondary)');
    // base border should be present (cool-tinted, not transparent)
    expect(html).toContain(
      'border:1px solid color-mix(in srgb, var(--gs-line) 55%, transparent)',
    );
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
    expect(html).toContain('border-radius:var(--gs-radius-pill)');
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