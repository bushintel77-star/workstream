/*
 * Field.test.tsx — Tier 3 primitive extraction tests.
 *
 * Verifies the pixel-stable contract for <Field>, <Input>, <Select>,
 * and the <GlassCard> header/footer slots using
 * `react-dom/server`'s renderToStaticMarkup (this repo intentionally
 * has no jsdom / @testing-library — the tests run in pure node).
 *
 * Contract under test:
 *   • <Input> renders a native <input> with the chrome-tier shell
 *     (same width/font/padding/border-radius/border/background/colour
 *     that InspectorCard's inline inputCss had before extraction).
 *   • <Select> renders a native <select> with the same shell.
 *   • <Field> renders a label + control (+ optional hint).
 *   • <GlassCard> collapses to the children-only render path when
 *     header and footer are both omitted (no DOM change for the four
 *     existing consumers).
 *   • <GlassCard> with both slots renders a header + body + footer
 *     shell.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { Field, Input, Select } from "./Field";
import { GlassCard } from "./GlassCard";

describe("<Input> chrome-tier shell", () => {
  it("renders a native <input> with the canonical chrome-tier style", () => {
    const html = renderToStaticMarkup(
      createElement(Input, { "data-testid": "probe" }),
    );
    expect(html).toMatch(/<input[^>]*data-testid="probe"/);
    expect(html).toContain('width:100%');
    expect(html).toContain('font-family:var(--font-ui)');
    expect(html).toContain('font-size:var(--gs-font-lg)');
    expect(html).toContain('padding:4px 6px');
    expect(html).toContain('border-radius:var(--gs-radius-chip)');
    expect(html).toContain('background:transparent');
    expect(html).toContain('color:var(--la-ink)');
  });

  it("forwards type/min/max/step so number inputs keep their constraints", () => {
    const html = renderToStaticMarkup(
      createElement(Input, {
        type: "number",
        min: 0,
        max: 360,
        step: 1,
        "data-testid": "num",
      }),
    );
    expect(html).toMatch(/type="number"/);
    expect(html).toMatch(/min="0"/);
    expect(html).toMatch(/max="360"/);
    expect(html).toMatch(/step="1"/);
  });

  it("merges consumer style overrides on top of the shell (consumer wins)", () => {
    const html = renderToStaticMarkup(
      createElement(Input, {
        "data-testid": "m",
        style: { padding: "8px 12px" },
      }),
    );
    // Consumer override present
    expect(html).toContain('padding:8px 12px');
    // Other shell props untouched
    expect(html).toContain('border-radius:var(--gs-radius-chip)');
  });
});

describe("<Select> chrome-tier shell", () => {
  it("renders a native <select> with the chrome-tier shell + forwarded children", () => {
    const html = renderToStaticMarkup(
      createElement(
        Select,
        { "data-testid": "sel" },
        createElement("option", { value: "a" }, "A"),
        createElement("option", { value: "b" }, "B"),
      ),
    );
    expect(html).toMatch(/<select[^>]*data-testid="sel"/);
    expect(html).toContain('font-size:var(--gs-font-lg)');
    expect(html).toContain('padding:4px 6px');
    expect(html).toContain('border-radius:var(--gs-radius-chip)');
    expect(html).toContain('<option value="a">A</option>');
    expect(html).toContain('<option value="b">B</option>');
  });
});

describe("<Field> chrome-tier row scaffold", () => {
  it("renders label + control + optional hint", () => {
    const html = renderToStaticMarkup(
      createElement(
        Field,
        { labelText: "SKU", hint: "Use the catalog id" },
        createElement(Input, { "data-testid": "in" }),
      ),
    );
    expect(html).toContain("SKU");
    expect(html).toContain("Use the catalog id");
    expect(html).toMatch(/data-testid="in"/);
  });

  it("renders without a hint span when hint is omitted", () => {
    const html = renderToStaticMarkup(
      createElement(
        Field,
        { labelText: "SKU" },
        createElement(Input, { "data-testid": "in" }),
      ),
    );
    expect(html).toContain("SKU");
    // No hint span — only one <span> in the row above the input.
    const beforeInput = html.split('data-testid="in"')[0];
    const spanCount = (beforeInput.match(/<span/g) ?? []).length;
    expect(spanCount).toBe(1);
  });
});

describe("<GlassCard> header/footer slots — Tier 3 §1", () => {
  it("renders the children-only path when neither header nor footer is supplied (pixel-stable for existing consumers)", () => {
    const html = renderToStaticMarkup(
      createElement(
        GlassCard,
        null,
        createElement("span", { "data-testid": "body" }, "body"),
      ),
    );
    expect(html).toMatch(/data-gs-glass-card="(true|)"/);
    // No slot dividers — original consumers see the same DOM.
    expect(html).not.toContain("data-gs-glass-header");
    expect(html).not.toContain("data-gs-glass-footer");
    expect(html).not.toContain("data-gs-glass-body");
    expect(html).toMatch(/data-testid="body"/);
  });

  it("renders header + body + footer when both slots are supplied", () => {
    const html = renderToStaticMarkup(
      createElement(
        GlassCard,
        {
          header: createElement("span", { "data-testid": "hdr" }, "H"),
          footer: createElement("span", { "data-testid": "ftr" }, "F"),
        } as React.ComponentProps<typeof GlassCard>,
        createElement("span", { "data-testid": "body" }, "B"),
      ),
    );
    expect(html).toContain("data-gs-glass-header");
    expect(html).toContain("data-gs-glass-footer");
    expect(html).toContain("data-gs-glass-body");
    expect(html).toMatch(/data-testid="hdr"/);
    expect(html).toMatch(/data-testid="body"/);
    expect(html).toMatch(/data-testid="ftr"/);
  });

  it("renders only header when footer is omitted", () => {
    const html = renderToStaticMarkup(
      createElement(
        GlassCard,
        { header: createElement("span", { "data-testid": "hdr" }, "H") } as React.ComponentProps<typeof GlassCard>,
        createElement("span", { "data-testid": "body" }, "B"),
      ),
    );
    expect(html).toContain("data-gs-glass-header");
    expect(html).not.toContain("data-gs-glass-footer");
    expect(html).toMatch(/data-testid="body"/);
  });
});