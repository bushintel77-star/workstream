import { describe, expect, it } from "vitest";
import {
  addSheetWidget,
  applySheetTemplate,
  clearPresentationPack,
  CURTIS_SHEET_TEMPLATES,
  emptyPresentationPack,
  MAX_SHEET_WIDGETS,
  moveSheetWidget,
  reflowSheetWidgets,
  removeSheetWidget,
  setSheetAtmosphere,
  setSheetPen,
  setSheetTheme,
  SHEET_TEMPLATE_CLEARED,
  widgetsInSlot,
} from "./sheet-presentation";

describe("sheet presentation", () => {
  it("seeds Curtis templates with unique widget ids", () => {
    expect(CURTIS_SHEET_TEMPLATES.length).toBeGreaterThanOrEqual(4);
    const pack = applySheetTemplate("curtis-client-brochure");
    expect(pack.theme).toBe("paper");
    expect(pack.pen).toBe("hand_drawn");
    expect(pack.atmosphere).toBe("cherry");
    expect(pack.template_id).toBe("curtis-client-brochure");
    expect(pack.widgets.length).toBeGreaterThanOrEqual(5);
    const ids = new Set(pack.widgets.map((w) => w.id));
    expect(ids.size).toBe(pack.widgets.length);
  });

  it("dark concept seeds deep grey wash", () => {
    const pack = applySheetTemplate("curtis-dark-concept");
    expect(pack.theme).toBe("deep");
    expect(pack.pen).toBe("grey_wash");
    expect(pack.atmosphere).toBe("pale_blue");
  });

  it("working drawing seeds technical graphite", () => {
    const pack = applySheetTemplate("curtis-working-drawing");
    expect(pack.pen).toBe("technical");
    expect(pack.atmosphere).toBe("graphite");
  });

  it("adds singleton widgets once and allows theme / pen / atmosphere", () => {
    let pack = emptyPresentationPack();
    pack = addSheetWidget(pack, "quote_total");
    pack = addSheetWidget(pack, "quote_total");
    expect(pack.widgets.filter((w) => w.type === "quote_total")).toHaveLength(
      1,
    );
    pack = setSheetTheme(pack, "deep");
    expect(pack.theme).toBe("deep");
    pack = setSheetPen(pack, "hand_drawn");
    pack = setSheetAtmosphere(pack, "terre_verte");
    expect(pack.pen).toBe("hand_drawn");
    expect(pack.atmosphere).toBe("terre_verte");
  });

  it("moves widgets between slots and removes them", () => {
    let pack = applySheetTemplate("curtis-client-brochure");
    const quote = pack.widgets.find((w) => w.type === "quote_total")!;
    pack = moveSheetWidget(pack, quote.id, "footer_band");
    expect(pack.widgets.find((w) => w.id === quote.id)?.slot).toBe(
      "footer_band",
    );
    pack = removeSheetWidget(pack, quote.id);
    expect(pack.widgets.some((w) => w.id === quote.id)).toBe(false);
  });

  it("reflows widgets into preferred slots deterministically", () => {
    let pack = applySheetTemplate("curtis-client-brochure");
    const quote = pack.widgets.find((w) => w.type === "quote_total")!;
    pack = moveSheetWidget(pack, quote.id, "footer_band");
    const once = reflowSheetWidgets(pack);
    const twice = reflowSheetWidgets(once);
    expect(widgetsInSlot(once, "side_stack").map((w) => w.type)).toContain(
      "quote_total",
    );
    expect(widgetsInSlot(once, "footer_band").map((w) => w.type)).toContain(
      "material_swatches",
    );
    expect(twice).toEqual(once);
  });

  it("unknown template does not silently seed another pack", () => {
    const pack = applySheetTemplate("not-a-real-template");
    expect(pack.widgets).toHaveLength(0);
    expect(pack.template_id).toBeUndefined();
  });

  it("clear marks template so Fit will not auto-seed", () => {
    const pack = clearPresentationPack(applySheetTemplate("curtis-minimal-ink"));
    expect(pack.widgets).toHaveLength(0);
    expect(pack.template_id).toBe(SHEET_TEMPLATE_CLEARED);
    expect(pack.theme).toBe("ink");
  });

  it("caps widgets at the contract max", () => {
    let pack = emptyPresentationPack();
    for (let i = 0; i < MAX_SHEET_WIDGETS + 4; i += 1) {
      pack = addSheetWidget(pack, "caption");
    }
    expect(pack.widgets.length).toBe(MAX_SHEET_WIDGETS);
  });
});
