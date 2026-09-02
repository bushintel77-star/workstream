import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { FieldloopPortal } from "./FieldloopPortal";

describe("<FieldloopPortal> customer portal", () => {
  it("starts on the access screen with the brand and secure-link CTA", () => {
    const html = renderToStaticMarkup(createElement(FieldloopPortal));
    expect(html).toContain("CAULFIELD SOUTH");
    expect(html).toContain("PLUMBING");
    expect(html).toContain("Send me a secure link");
    expect(html).toContain("No password needed");
    // The account screen stays mounted but hidden until sign-in.
    expect(html).toContain("Hi, S. Whitfield");
    expect(html).toContain("Annual Gas Safety Check due soon");
    expect(html).toContain("Gas leak inspection");
    expect(html).toContain("$214.50");
  });
});
