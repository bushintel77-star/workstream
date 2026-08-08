import { describe, expect, it } from "vitest";
import { buildArchitecturalTitleBlock } from "./architectural-title-block";

describe("buildArchitecturalTitleBlock", () => {
  it("surfaces Vicmap SPI / PFI and council for selected address", () => {
    const block = buildArchitecturalTitleBlock({
      address: "12 Wrights Terrace, Prahran VIC 3181",
      vicmapHit: true,
      parcel: {
        spi: "3\\LP218573",
        pfi: "1234567",
        lgaCode: "363",
        lotAreaM2: 412.4,
        propNum: "98765",
      },
    });
    expect(block.sourceKind).toBe("vicmap");
    expect(block.sourceLabel).toContain("Vicmap");
    expect(block.parcelRef).toBe("3\\LP218573");
    expect(block.councilLabel).toBe("City of Stonnington");
    expect(block.lotAreaM2).toBe(412);
    expect(block.metaLine).toContain("SPI");
    expect(block.metaLine).toContain("Stonnington");
    expect(block.notesLine).toContain("Vicmap Property");
  });

  it("falls back to survey without inventing CT numbers", () => {
    const block = buildArchitecturalTitleBlock({
      address: "14 Airlie Ave, Armadale VIC 3143",
      survey: { lot_area_m2: 380, garden_area_m2: 220 },
    });
    expect(block.sourceKind).toBe("survey");
    expect(block.parcelRef).toBeNull();
    expect(block.metaLine).not.toMatch(/CT\s+\d/);
    expect(block.lotAreaM2).toBe(380);
    expect(block.councilLabel).toBe("City of Stonnington");
  });

  it("uses indicative copy when no parcel or survey", () => {
    const block = buildArchitecturalTitleBlock({
      address: "1 Example St, Melbourne VIC 3000",
    });
    expect(block.sourceKind).toBe("indicative");
    expect(block.notesLine).toMatch(/confirm/i);
    expect(block.hpuM).toBeNull();
  });

  it("surfaces Vicmap HPU in meta and notes when present", () => {
    const block = buildArchitecturalTitleBlock({
      address: "12 Wrights Terrace, Prahran VIC 3181",
      vicmapHit: true,
      parcel: {
        spi: "3\\LP218573",
        lgaCode: "363",
        lotAreaM2: 412,
        hpuM: 1.5,
      },
    });
    expect(block.hpuM).toBe(1.5);
    expect(block.metaLine).toContain("HPU ±1.5 m");
    expect(block.notesLine).toContain("Boundary accuracy ±1.5 m");
  });
});
