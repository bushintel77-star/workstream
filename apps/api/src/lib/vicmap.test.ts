import { describe, expect, it } from "vitest";
import { extractVicmapParcelAttrs } from "./vicmap";

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

  it("tolerates missing properties", () => {
    const attrs = extractVicmapParcelAttrs(undefined, 0);
    expect(attrs.pfi).toBeNull();
    expect(attrs.lotAreaM2).toBeNull();
  });
});
