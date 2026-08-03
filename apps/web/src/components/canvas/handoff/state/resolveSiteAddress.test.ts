import { describe, expect, it } from "vitest";

import { STUDIO_SITES } from "../studioCatalog";
import { resolveSiteAddress } from "./resolveSiteAddress";

const SITES = [
  { addr: "12 Wrights Terrace, Prahran VIC 3181" },
  { addr: "14 Airlie Ave, Armadale VIC 3143" },
] as const;

const REAL = "60 Malvern Road, Glenwood NSW 2768";

describe("resolveSiteAddress — project address wins by default", () => {
  it("returns the project address when the operator has not switched site", () => {
    expect(
      resolveSiteAddress({
        projectAddress: REAL,
        siteIdx: 0,
        siteExplicit: false,
        sites: SITES,
      }),
    ).toBe(REAL);
  });

  it("treats an absent siteExplicit flag as 'not explicit'", () => {
    // `siteExplicit` is optional so StudioUiState in studioTypes.ts stays
    // structurally compatible; absent must not mean "use the demo seed".
    expect(
      resolveSiteAddress({ projectAddress: REAL, siteIdx: 0, sites: SITES }),
    ).toBe(REAL);
  });

  it("still prefers the project address at a non-zero siteIdx", () => {
    // This is the regression. siteIdx is seed-geometry state; on its own it must
    // never override the real address.
    expect(
      resolveSiteAddress({
        projectAddress: REAL,
        siteIdx: 1,
        siteExplicit: false,
        sites: SITES,
      }),
    ).toBe(REAL);
  });
});

describe("resolveSiteAddress — explicit switch wins", () => {
  it("returns the picked demo site once the operator switches", () => {
    expect(
      resolveSiteAddress({
        projectAddress: REAL,
        siteIdx: 1,
        siteExplicit: true,
        sites: SITES,
      }),
    ).toBe(SITES[1].addr);
  });

  it("falls back to the project address if the picked index is out of range", () => {
    expect(
      resolveSiteAddress({
        projectAddress: REAL,
        siteIdx: 99,
        siteExplicit: true,
        sites: SITES,
      }),
    ).toBe(REAL);
  });
});

describe("resolveSiteAddress — blank project address", () => {
  it("falls through to the seed rather than rendering an empty title block", () => {
    expect(
      resolveSiteAddress({
        projectAddress: "",
        siteIdx: 0,
        siteExplicit: false,
        sites: SITES,
      }),
    ).toBe(SITES[0].addr);
  });

  it("treats a whitespace-only address as blank", () => {
    expect(
      resolveSiteAddress({
        projectAddress: "   \t ",
        siteIdx: 1,
        siteExplicit: false,
        sites: SITES,
      }),
    ).toBe(SITES[1].addr);
  });

  it("returns the empty string only when there is nothing at all to show", () => {
    expect(
      resolveSiteAddress({ projectAddress: "  ", siteIdx: 0, sites: [] }),
    ).toBe("");
  });
});

describe("resolveSiteAddress — against the shipped catalog", () => {
  it("does not render the Wrights demo seed for a real project", () => {
    // The shipped symptom: header showed 12 Wrights Terrace while the Quote
    // showed the real address. Assert against the real STUDIO_SITES, not a
    // fixture, so a catalog reorder cannot silently reintroduce it.
    const resolved = resolveSiteAddress({
      projectAddress: REAL,
      siteIdx: 0,
      siteExplicit: false,
    });
    expect(resolved).toBe(REAL);
    expect(resolved).not.toBe(STUDIO_SITES[0]!.addr);
  });

  it("preserves the address untrimmed so it matches what Quote renders", () => {
    expect(
      resolveSiteAddress({ projectAddress: ` ${REAL} `, siteIdx: 0 }),
    ).toBe(` ${REAL} `);
  });
});
