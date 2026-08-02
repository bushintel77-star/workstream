import { describe, expect, it } from "vitest";
import {
  discoverKeylessLayerNames,
  EASEMENT_LINE_CAP,
  explodeExteriorRings,
  extractPoints,
  extractPolylines,
  extractVicmapParcelAttrs,
  parseFeatureTypeNames,
  parseGeometryFieldName,
  pickBestLayerName,
  pickPlausibleBuildingRing,
  pickTitleRingForPin,
  scoreBuildingLayerName,
  scoreBushfireLayerName,
  scoreEasementLayerName,
  scoreFloodLayerName,
  scoreHeritageLayerName,
  scorePropertyLayerName,
  scoreUrbanTreeLayerName,
  bufferedTitleBboxRing,
  selectNeighbourRings,
  NEIGHBOUR_BUILDING_CAP,
} from "./vicmap";

describe("extractPoints", () => {
  it("reads a Point", () => {
    expect(
      extractPoints({
        type: "Point",
        coordinates: [145.01, -37.85],
      }),
    ).toEqual([[145.01, -37.85]]);
  });

  it("flattens MultiPoint and drops invalid coords", () => {
    expect(
      extractPoints({
        type: "MultiPoint",
        coordinates: [
          [145.0, -37.85],
          [Number.NaN, -37.9],
          [145.02, -37.86],
        ],
      }),
    ).toEqual([
      [145.0, -37.85],
      [145.02, -37.86],
    ]);
  });

  it("returns empty for line geometry", () => {
    expect(
      extractPoints({
        type: "LineString",
        coordinates: [
          [145.0, -37.85],
          [145.001, -37.851],
        ],
      }),
    ).toEqual([]);
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

  it("bounds easement line payload cap", () => {
    expect(EASEMENT_LINE_CAP).toBe(24);
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

  it("rejects annotation / non-easement names; proposed ranks below full easement", () => {
    expect(scoreEasementLayerName("open-data-platform:easement_anno")).toBeLessThan(0);
    expect(
      scoreEasementLayerName("open-data-platform:easement_proposed"),
    ).toBeLessThan(scoreEasementLayerName("open-data-platform:easement"));
    expect(scoreEasementLayerName("open-data-platform:property_view")).toBe(
      -Infinity,
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

describe("pickPlausibleBuildingRing", () => {
  // Small title (~400 m²).
  const title: [number, number][] = [
    [144.99, -37.85],
    [144.9902, -37.85],
    [144.9902, -37.8498],
    [144.99, -37.8498],
    [144.99, -37.85],
  ];
  // House that fits inside title.
  const house: [number, number][] = [
    [144.99005, -37.84995],
    [144.99012, -37.84995],
    [144.99012, -37.84988],
    [144.99005, -37.84988],
    [144.99005, -37.84995],
  ];
  // Neighbour complex larger than the title (classic INTERSECTS trap).
  const complex: [number, number][] = [
    [144.989, -37.851],
    [144.992, -37.851],
    [144.992, -37.848],
    [144.989, -37.848],
    [144.989, -37.851],
  ];

  it("prefers a house that fits the title over a larger intersecting complex", () => {
    const picked = pickPlausibleBuildingRing(title, [complex, house]);
    expect(picked).toBe(house);
  });

  it("returns null when every candidate exceeds the coverage cap", () => {
    expect(pickPlausibleBuildingRing(title, [complex])).toBeNull();
  });
});

describe("neighbour building selection", () => {
  // A ~20 x 20 m subject lot near Melbourne (degrees; ~1.1e-5 deg ≈ 1.2 m lat).
  const subjectTitle: [number, number][] = [
    [145.0, -37.85],
    [145.00025, -37.85],
    [145.00025, -37.84982],
    [145.0, -37.84982],
    [145.0, -37.85],
  ];
  // Dwelling whose centroid sits inside the title.
  const subjectDwelling: [number, number][] = [
    [145.00005, -37.84996],
    [145.0002, -37.84996],
    [145.0002, -37.84986],
    [145.00005, -37.84986],
  ];
  // Neighbour to the east, centroid clearly outside the title.
  const neighbourEast: [number, number][] = [
    [145.0004, -37.84996],
    [145.00055, -37.84996],
    [145.00055, -37.84986],
    [145.0004, -37.84986],
  ];

  it("buffers the title bbox outward so adjacent lots are reached", () => {
    const ring = bufferedTitleBboxRing(subjectTitle);
    const xs = ring.map((c) => c[0]);
    expect(Math.min(...xs)).toBeLessThan(145.0);
    expect(Math.max(...xs)).toBeGreaterThan(145.00025);
    // Closed ring (first === last).
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it("drops the subject dwelling and keeps neighbours", () => {
    const kept = selectNeighbourRings(subjectTitle, [
      subjectDwelling,
      neighbourEast,
    ]);
    expect(kept).toHaveLength(1);
    expect(kept[0]).toBe(neighbourEast);
  });

  it("caps the number of neighbours returned", () => {
    const many = Array.from({ length: NEIGHBOUR_BUILDING_CAP + 5 }, (_, i) => {
      const x = 145.0004 + i * 0.0002;
      return [
        [x, -37.84996],
        [x + 0.00015, -37.84996],
        [x + 0.00015, -37.84986],
        [x, -37.84986],
      ] as [number, number][];
    });
    expect(selectNeighbourRings(subjectTitle, many)).toHaveLength(
      NEIGHBOUR_BUILDING_CAP,
    );
  });
});
