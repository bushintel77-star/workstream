import { describe, expect, it } from "vitest";
import {
  discoverKeylessLayerNames,
  explodeExteriorRings,
  extractVicmapParcelAttrs,
  parseFeatureTypeNames,
  parseGeometryFieldName,
  pickBestLayerName,
  pickTitleRingForPin,
  scoreBuildingLayerName,
  scoreBushfireLayerName,
  scoreEasementLayerName,
  scoreFloodLayerName,
  scoreHeritageLayerName,
  scorePropertyLayerName,
  scoreUrbanTreeLayerName,
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

  it("prefers easement over approved/proposed simplified views", () => {
    const easementNames = [
      "open-data-platform:v_s_easement_proposed",
      "open-data-platform:v_s_easement_approved",
      "open-data-platform:easement",
      "open-data-platform:v_s_easement_approved_anno",
      "open-data-platform:hy_watercourse",
    ];
    expect(pickBestLayerName(easementNames, scoreEasementLayerName)).toBe(
      "open-data-platform:easement",
    );
    expect(
      scoreEasementLayerName("open-data-platform:v_s_easement_approved_anno"),
    ).toBeLessThan(0);
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

  it("discovers KEYLESS next layer names from capabilities", () => {
    const names = [
      ...sampleNames,
      "open-data-platform:easement",
      "open-data-platform:bushfire_prone_area",
      "open-data-platform:tree_urban",
      "open-data-platform:planning_zone",
      "open-data-platform:road_casement_polygon",
      "open-data-platform:lsio",
      "open-data-platform:heritage_overlay",
    ];
    const found = discoverKeylessLayerNames(names);
    expect(found.easement).toBe("open-data-platform:easement");
    expect(found.bushfire).toBe("open-data-platform:bushfire_prone_area");
    expect(found.urban_tree).toBe("open-data-platform:tree_urban");
    expect(found.planning).toBe("open-data-platform:planning_zone");
    expect(found.road_casement).toBe("open-data-platform:road_casement_polygon");
    expect(found.flood).toBe("open-data-platform:lsio");
    expect(found.heritage).toBe("open-data-platform:heritage_overlay");
    expect(scoreEasementLayerName("open-data-platform:easement")).toBeGreaterThan(0);
    expect(scoreBushfireLayerName("open-data-platform:address")).toBeLessThan(0);
    expect(scoreUrbanTreeLayerName("open-data-platform:tree_urban")).toBeGreaterThan(
      0,
    );
    expect(scoreFloodLayerName("open-data-platform:lsio")).toBeGreaterThan(0);
    expect(scoreHeritageLayerName("open-data-platform:heritage_overlay")).toBeGreaterThan(
      0,
    );
  });

  it("scores parcel_view as a strong fallback", () => {
    expect(scorePropertyLayerName("open-data-platform:parcel_view")).toBeGreaterThan(
      scorePropertyLayerName("open-data-platform:cad_area_bdy"),
    );
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

describe("pickTitleRingForPin", () => {
  // ~400 m² residential lot around the pin (degrees ≈ metres/111km).
  const houseLot: [number, number][] = [
    [144.99, -37.85],
    [144.9902, -37.85],
    [144.9902, -37.8498],
    [144.99, -37.8498],
    [144.99, -37.85],
  ];
  // Park-scale ring that also contains the pin (MultiPolygon trap).
  const park: [number, number][] = [
    [144.98, -37.86],
    [145.01, -37.86],
    [145.01, -37.84],
    [144.98, -37.84],
    [144.98, -37.86],
  ];

  it("prefers the small residential ring over a park MultiPolygon part", () => {
    const pinLng = 144.9901;
    const pinLat = -37.8499;
    const picked = pickTitleRingForPin([park, houseLot], pinLng, pinLat);
    expect(picked).toBe(houseLot);
  });

  it("explodes MultiPolygon exteriors", () => {
    const rings = explodeExteriorRings({
      type: "MultiPolygon",
      coordinates: [[park], [houseLot]],
    });
    expect(rings).toHaveLength(2);
  });
});
