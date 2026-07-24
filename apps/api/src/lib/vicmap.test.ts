import { describe, expect, it } from "vitest";
import {
  extractPolylines,
  extractVicmapParcelAttrs,
  parseFeatureTypeNames,
  parseGeometryFieldName,
  pickBestLayerName,
  scoreBuildingLayerName,
  scoreEasementLayerName,
  scorePropertyLayerName,
} from "./vicmap";

describe("extractVicmapParcelAttrs", () => {
  it("reads mixed-case Vicmap property_view fields", () => {
    const attrs = extractVicmapParcelAttrs(
      {
        PROP_PFI: "1122334",
        PROP_PROPNUM: "554433",
        PROP_LGA_CODE: "363",
        SPI: "3\\LP218573",
      },
      412.2,
    );
    expect(attrs.pfi).toBe("1122334");
    expect(attrs.propNum).toBe("554433");
    expect(attrs.lgaCode).toBe("363");
    expect(attrs.spi).toBe("3\\LP218573");
    expect(attrs.lotAreaM2).toBe(412.2);
  });

  it("reads lowercase DescribeFeatureType-style fields", () => {
    const attrs = extractVicmapParcelAttrs({ pfi: "99", spi: "1\\PS123" }, 200);
    expect(attrs.pfi).toBe("99");
    expect(attrs.spi).toBe("1\\PS123");
  });

  it("tolerates missing properties", () => {
    const attrs = extractVicmapParcelAttrs(undefined, 0);
    expect(attrs.pfi).toBeNull();
    expect(attrs.lotAreaM2).toBeNull();
  });
});

describe("layer discovery scoring", () => {
  const sampleNames = [
    "open-data-platform:hy_watercourse",
    "open-data-platform:solar_farm_properties",
    "open-data-platform:building_point",
    "open-data-platform:building_polygon",
    "open-data-platform:parcel_view",
    "open-data-platform:property_view",
    "open-data-platform:v_property_mp",
    "open-data-platform:v_s_property_proposed",
    "open-data-platform:address",
    "open-data-platform:cad_area_bdy",
  ];

  it("prefers property_view over parcel / multipolygon aliases", () => {
    expect(pickBestLayerName(sampleNames, scorePropertyLayerName)).toBe(
      "open-data-platform:property_view",
    );
  });

  it("prefers building_polygon over building_point", () => {
    expect(pickBestLayerName(sampleNames, scoreBuildingLayerName)).toBe(
      "open-data-platform:building_polygon",
    );
  });

  it("rejects solar / address / proposed property-ish names", () => {
    expect(scorePropertyLayerName("open-data-platform:solar_farm_properties")).toBeLessThan(
      0,
    );
    expect(scorePropertyLayerName("open-data-platform:address")).toBeLessThan(0);
    expect(
      scorePropertyLayerName("open-data-platform:v_s_property_proposed"),
    ).toBeLessThan(0);
  });

  it("scores parcel_view as a strong fallback", () => {
    expect(scorePropertyLayerName("open-data-platform:parcel_view")).toBeGreaterThan(
      scorePropertyLayerName("open-data-platform:cad_area_bdy"),
    );
  });

  it("prefers the exact easement layer over variants", () => {
    const names = [
      ...sampleNames,
      "open-data-platform:easement_anno",
      "open-data-platform:easement",
      "open-data-platform:easement_proposed",
    ];
    expect(pickBestLayerName(names, scoreEasementLayerName)).toBe(
      "open-data-platform:easement",
    );
  });

  it("rejects annotation / proposed / non-easement names", () => {
    expect(scoreEasementLayerName("open-data-platform:easement_anno")).toBeLessThan(0);
    expect(
      scoreEasementLayerName("open-data-platform:easement_proposed"),
    ).toBeLessThan(0);
    expect(scoreEasementLayerName("open-data-platform:property_view")).toBe(
      -Infinity,
    );
  });
});

describe("extractPolylines", () => {
  it("wraps a LineString into a single polyline", () => {
    expect(
      extractPolylines({
        type: "LineString",
        coordinates: [
          [145.0, -37.85],
          [145.001, -37.851],
        ],
      }),
    ).toEqual([
      [
        [145.0, -37.85],
        [145.001, -37.851],
      ],
    ]);
  });

  it("flattens MultiLineString parts and drops degenerate ones", () => {
    const lines = extractPolylines({
      type: "MultiLineString",
      coordinates: [
        [
          [145.0, -37.85],
          [145.001, -37.851],
        ],
        [[145.002, -37.852]],
      ],
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toHaveLength(2);
  });

  it("returns empty for polygon geometry", () => {
    expect(
      extractPolylines({
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      }),
    ).toEqual([]);
  });
});

describe("parseFeatureTypeNames", () => {
  it("extracts workspace:layer Name elements", () => {
    const xml = `
      <wfs:WFS_Capabilities>
        <FeatureTypeList>
          <FeatureType><Name>open-data-platform:property_view</Name></FeatureType>
          <FeatureType><Name>open-data-platform:building_polygon</Name></FeatureType>
        </FeatureTypeList>
      </wfs:WFS_Capabilities>`;
    expect(parseFeatureTypeNames(xml)).toEqual([
      "open-data-platform:property_view",
      "open-data-platform:building_polygon",
    ]);
  });
});

describe("parseGeometryFieldName", () => {
  it("finds geom from DescribeFeatureType XSD", () => {
    const xsd = `
      <xsd:schema>
        <xsd:element name="pfi" type="xsd:string"/>
        <xsd:element name="geom" nillable="true" type="gml:MultiSurfacePropertyType"/>
      </xsd:schema>`;
    expect(parseGeometryFieldName(xsd)).toBe("geom");
  });

  it("prefers geom over shape when both present", () => {
    const xsd = `
      <xsd:element name="shape" type="gml:GeometryPropertyType"/>
      <xsd:element name="geom" type="gml:MultiSurfacePropertyType"/>`;
    expect(parseGeometryFieldName(xsd)).toBe("geom");
  });
});
