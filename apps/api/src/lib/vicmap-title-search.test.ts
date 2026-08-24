import { describe, expect, it } from "vitest";
import {
  buildExactEziCql,
  buildStructuredCql,
  parseStreetAddress,
} from "./vicmap-title-search";

describe("parseStreetAddress", () => {
  it("parses the plain form", () => {
    expect(parseStreetAddress("10 Hopetoun Road Toorak")).toEqual({
      unit: null,
      houseNumber: "10",
      roadName: "HOPETOUN",
      roadType: "ROAD",
      locality: "TOORAK",
    });
  });

  it("expands street-type abbreviations", () => {
    const p = parseStreetAddress("10 Hopetoun Rd, Toorak VIC 3142");
    expect(p?.roadType).toBe("ROAD");
    expect(p?.locality).toBe("TOORAK");
  });

  it("strips a bare postcode tail", () => {
    expect(parseStreetAddress("23 Thomas Road Healesville 3777")?.locality).toBe(
      "HEALESVILLE",
    );
  });

  it("parses slash units and UNIT-word units", () => {
    expect(parseStreetAddress("5/10 Leake Street Essendon")).toMatchObject({
      unit: "5",
      houseNumber: "10",
      roadType: "STREET",
    });
    expect(parseStreetAddress("Unit 3, 12 Smith St Fitzroy")).toMatchObject({
      unit: "3",
      houseNumber: "12",
      roadType: "STREET",
    });
  });

  it("keeps multi-word road names and localities", () => {
    const p = parseStreetAddress("8 Oliver Hill Road Mount Dandenong");
    expect(p).toMatchObject({
      roadName: "OLIVER HILL",
      roadType: "ROAD",
      locality: "MOUNT DANDENONG",
    });
  });

  it("rejects input without a house number or road", () => {
    expect(parseStreetAddress("Toorak")).toBeNull();
    expect(parseStreetAddress("hello world")).toBeNull();
    expect(parseStreetAddress("")).toBeNull();
  });
});

describe("buildExactEziCql", () => {
  it("anchors the match on the house number so 110 never satisfies 10", () => {
    const cql = buildExactEziCql(parseStreetAddress("10 Hopetoun Road Toorak")!);
    expect(cql).toContain("add_ezi_address ILIKE '10 HOPETOUN ROAD TOORAK %'");
  });

  it("escapes single quotes in road names", () => {
    const cql = buildExactEziCql(
      parseStreetAddress("12 O'Brien Road Essendon")!,
    );
    expect(cql).toContain("O''BRIEN");
    expect(cql).not.toMatch(/O'BRIEN(?!='')/);
  });
});

describe("buildStructuredCql", () => {
  it("matches on the keyed address fields, primary only", () => {
    const cql = buildStructuredCql(parseStreetAddress("10 Hopetoun Road Toorak")!);
    expect(cql).toContain("add_house_number_1='10'");
    expect(cql).toContain("add_road_name");
    expect(cql).toContain("add_locality_name='TOORAK'");
    expect(cql).toContain("add_is_primary='Y'");
    expect(cql).not.toContain("add_blg_unit_id_1");
  });

  it("constrains the unit when the address carries one", () => {
    const cql = buildStructuredCql(
      parseStreetAddress("5/10 Leake Street Essendon")!,
    );
    expect(cql).toContain("add_blg_unit_id_1='5'");
  });
});
