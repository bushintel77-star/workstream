import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QuotePortal, type PortalQuoteData } from "./QuotePortal";

const DATA: PortalQuoteData = {
  project: {
    id: "project-123",
    address: "12 Domain Rd, South Yarra VIC",
    created_at: "2026-08-22T00:00:00.000Z",
  },
  survey: null,
  design: null,
  costing: null,
  costings: [
    {
      scenario: "standard",
      subtotal: 50000,
      gst: 5000,
      total: 55000,
      line_items: [
        {
          label: "Bluestone paving",
          qty: 42,
          unit: "m2",
          rate: 380,
          total: 15960,
          is_provisional: false,
        },
      ],
    },
    {
      scenario: "buffer",
      subtotal: 56000,
      gst: 5600,
      total: 61600,
      line_items: [
        {
          label: "Bluestone paving",
          qty: 42,
          unit: "m2",
          rate: 420,
          total: 17640,
          is_provisional: false,
        },
      ],
    },
    {
      scenario: "client-brief",
      subtotal: 60000,
      gst: 6000,
      total: 66000,
      line_items: [],
    },
  ],
};

describe("QuotePortal scenario controls", () => {
  it("wires tabs to an explicit tabpanel", () => {
    const html = renderToStaticMarkup(
      createElement(QuotePortal, { data: DATA, token: "token-123", generatedDate: "26 August 2026" }),
    );

    expect(html).toContain('role="tablist"');
    expect(html).toContain('id="quote-scenario-tab-standard"');
    expect(html).toContain('aria-controls="quote-scenario-panel-standard"');
    expect(html).toContain('id="quote-scenario-panel-standard"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('aria-labelledby="quote-scenario-tab-standard"');
  });

  it("renders API-provided custom scenarios as valid tabs", () => {
    const html = renderToStaticMarkup(
      createElement(QuotePortal, { data: DATA, token: "token-123", generatedDate: "26 August 2026" }),
    );

    expect(html).toContain('id="quote-scenario-tab-client-brief"');
    expect(html).toContain('aria-controls="quote-scenario-panel-client-brief"');
    expect(html).toContain('aria-labelledby="quote-scenario-tab-standard"');
  });

  it("keeps inactive tabs out of the tab order", () => {
    const html = renderToStaticMarkup(
      createElement(QuotePortal, { data: DATA, token: "token-123", generatedDate: "26 August 2026" }),
    );

    expect(html).toMatch(
      /id="quote-scenario-tab-standard"[^>]*aria-selected="true"[^>]*tabindex="0"/,
    );
    expect(html).toMatch(
      /id="quote-scenario-tab-buffer"[^>]*aria-selected="false"[^>]*tabindex="-1"/,
    );
  });
});
