import type {
  AtmospherePigment,
  PresentationPack,
  PresentationPen,
  PresentationSlot,
  PresentationTheme,
  PresentationWidget,
  PresentationWidgetType,
} from "@workstream/contracts";

/** Matches PresentationPackSchema.widgets.max(24). */
export const MAX_SHEET_WIDGETS = 24;

/** Persist this template_id after Clear so Fit open does not re-seed a brochure. */
export const SHEET_TEMPLATE_CLEARED = "cleared";

function newId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  // RFC4122-ish fallback — contracts require UUID widget ids.
  const hex = () =>
    Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, "0");
  return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-a${hex().slice(1)}-${hex()}${hex()}${hex()}`;
}

/** Widget catalogue for Fit-sheet compose (canvas feature). */
export const SHEET_WIDGET_LIBRARY: Array<{
  type: PresentationWidgetType;
  label: string;
  detail: string;
  defaultSlot: PresentationSlot;
  defaultEmphasis: PresentationWidget["style"]["emphasis"];
}> = [
    {
      type: "quote_total",
      label: "Quote total",
      detail: "Incl. GST hero from the live BOM",
      defaultSlot: "side_stack",
      defaultEmphasis: "hero",
    },
    {
      type: "savings_ledger",
      label: "Savings ledger",
      detail: "Wrights Terrace value reallocation",
      defaultSlot: "side_stack",
      defaultEmphasis: "standard",
    },
    {
      type: "zone_summary",
      label: "Zone summary",
      detail: "Live irrigation zones or placement massing",
      defaultSlot: "side_stack",
      defaultEmphasis: "quiet",
    },
    {
      type: "material_swatches",
      label: "Material swatches",
      detail: "Chips from placed materials on the drawing",
      defaultSlot: "footer_band",
      defaultEmphasis: "quiet",
    },
    {
      type: "caption",
      label: "Caption",
      detail: "Client-facing one-liner",
      defaultSlot: "title_meta",
      defaultEmphasis: "standard",
    },
  ];

export const SHEET_THEME_SWATCHES: Array<{
  id: PresentationTheme;
  label: string;
}> = [
    { id: "parchment", label: "Parchment" },
    { id: "ink", label: "Ink" },
    /** Dark-concept chalk on `--surface-deep`. */
    { id: "deep", label: "Deep" },
  ];

export const SHEET_PEN_SWATCHES: Array<{
  id: PresentationPen;
  label: string;
  detail: string;
}> = [
    {
      id: "technical",
      label: "Technical",
      detail: "Thin mono CAD line — working drawing",
    },
    {
      id: "hand_drawn",
      label: "Freehand",
      detail: "Role-tuned Rough pencil — boundary firm, canopy soft",
    },
    {
      id: "grey_wash",
      label: "Grey wash",
      detail: "Tonal fills + crisp dark outline — illustrator register",
    },
    {
      id: "watercolour",
      label: "Watercolour",
      detail: "Soft wash + paper tooth on regions — concept brochure",
    },
  ];

/** Atmosphere Palette — pigments, not hex. */
export const ATMOSPHERE_PIGMENT_SWATCHES: Array<{
  id: AtmospherePigment;
  label: string;
  /** CSS colour for chip preview / selective accent. */
  hex: string;
}> = [
    { id: "graphite", label: "Graphite", hex: "#5c5a56" },
    { id: "cherry", label: "Cherry", hex: "#b85c6a" },
    { id: "pale_blue", label: "Pale blue", hex: "#7a9bb8" },
    { id: "terre_verte", label: "Terre verte", hex: "#6b7f5a" },
    { id: "yellow_ochre", label: "Ochre", hex: "#c4a35a" },
    { id: "burnt_umber", label: "Umber", hex: "#8b5e3c" },
    { id: "sage", label: "Sage", hex: "#7d8f74" },
  ];

export type SheetTemplate = {
  id: string;
  label: string;
  detail: string;
  pack: Omit<PresentationPack, "widgets"> & {
    widgets: Array<Omit<PresentationWidget, "id">>;
  };
};

function widget(
  type: PresentationWidgetType,
  slot: PresentationSlot,
  order: number,
  style: PresentationWidget["style"],
  text?: string,
): Omit<PresentationWidget, "id"> {
  return { type, slot, order, style, text };
}

/** Curtis house-style seed templates. */
export const CURTIS_SHEET_TEMPLATES: SheetTemplate[] = [
  {
    id: "curtis-working-drawing",
    label: "Working drawing",
    detail: "Light caption — CAD paper",
    pack: {
      theme: "parchment",
      pen: "technical",
      atmosphere: "graphite",
      template_id: "curtis-working-drawing",
      widgets: [
        widget("caption", "title_meta", 0, {
          accent: "ink",
          emphasis: "quiet",
        }, "Working drawing — indicative · not for construction"),
      ],
    },
  },
  {
    id: "curtis-client-brochure",
    label: "Client brochure",
    detail: "Quote hero + ledger + swatches on one sheet",
    pack: {
      theme: "parchment",
      pen: "hand_drawn",
      atmosphere: "cherry",
      template_id: "curtis-client-brochure",
      widgets: [
        widget("caption", "title_meta", 0, {
          accent: "ink",
          emphasis: "standard",
        }, "NO.1 · Concept presentation"),
        widget("quote_total", "side_stack", 0, {
          accent: "ink",
          emphasis: "hero",
        }),
        widget("savings_ledger", "side_stack", 1, {
          accent: "gold",
          emphasis: "standard",
        }),
        widget("zone_summary", "side_stack", 2, {
          accent: "sage",
          emphasis: "quiet",
        }),
        widget("material_swatches", "footer_band", 0, {
          accent: "ink",
          emphasis: "quiet",
        }),
      ],
    },
  },
  {
    id: "curtis-minimal-ink",
    label: "Minimal ink",
    detail: "Quiet caption + quote — night-meeting calm",
    pack: {
      theme: "ink",
      pen: "technical",
      atmosphere: "graphite",
      template_id: "curtis-minimal-ink",
      widgets: [
        widget("caption", "title_meta", 0, {
          accent: "ink",
          emphasis: "standard",
        }, "Garden concept"),
        widget("quote_total", "side_stack", 0, {
          accent: "ink",
          emphasis: "hero",
        }),
      ],
    },
  },
  {
    id: "curtis-dark-concept",
    label: "Dark concept",
    detail: "Chalk on deep ground — night presentation",
    pack: {
      theme: "deep",
      pen: "grey_wash",
      atmosphere: "pale_blue",
      template_id: "curtis-dark-concept",
      widgets: [
        widget("caption", "title_meta", 0, {
          accent: "ink",
          emphasis: "standard",
        }, "NO.1 · Dark concept"),
        widget("quote_total", "side_stack", 0, {
          accent: "gold",
          emphasis: "hero",
        }),
        widget("zone_summary", "side_stack", 1, {
          accent: "sage",
          emphasis: "quiet",
        }),
        widget("material_swatches", "footer_band", 0, {
          accent: "ink",
          emphasis: "quiet",
        }),
      ],
    },
  },
];

export function emptyPresentationPack(): PresentationPack {
  return {
    theme: "parchment",
    pen: "technical",
    atmosphere: "graphite",
    widgets: [],
  };
}

/** Explicit Clear — keeps theme/pen/atmosphere, marks template so Fit does not auto-seed. */
export function clearPresentationPack(
  pack: PresentationPack = emptyPresentationPack(),
): PresentationPack {
  return {
    theme: pack.theme,
    pen: pack.pen ?? "technical",
    atmosphere: pack.atmosphere ?? "graphite",
    template_id: SHEET_TEMPLATE_CLEARED,
    widgets: [],
  };
}

export function applySheetTemplate(templateId: string): PresentationPack {
  if (templateId === SHEET_TEMPLATE_CLEARED) {
    return clearPresentationPack();
  }
  const tpl = CURTIS_SHEET_TEMPLATES.find((t) => t.id === templateId);
  if (!tpl) {
    // Unknown id — leave pack empty rather than silently seeding another template.
    return emptyPresentationPack();
  }
  return {
    theme: tpl.pack.theme,
    pen: tpl.pack.pen ?? "technical",
    atmosphere: tpl.pack.atmosphere ?? "graphite",
    template_id: tpl.id,
    widgets: tpl.pack.widgets.map((w) => ({
      ...w,
      id: newId(),
      style: { ...w.style },
    })),
  };
}

export function addSheetWidget(
  pack: PresentationPack,
  type: PresentationWidgetType,
): PresentationPack {
  const meta = SHEET_WIDGET_LIBRARY.find((w) => w.type === type);
  if (!meta) return pack;
  if (pack.widgets.some((w) => w.type === type && type !== "caption")) {
    // Singletons for most types — caption may repeat.
    return pack;
  }
  if (pack.widgets.length >= MAX_SHEET_WIDGETS) return pack;
  const sameSlot = pack.widgets.filter((w) => w.slot === meta.defaultSlot);
  const order = sameSlot.reduce((m, w) => Math.max(m, w.order), -1) + 1;
  const next: PresentationWidget = {
    id: newId(),
    type,
    slot: meta.defaultSlot,
    order,
    style: {
      accent: type === "savings_ledger" ? "gold" : "ink",
      emphasis: meta.defaultEmphasis,
    },
  };
  return { ...pack, widgets: [...pack.widgets, next] };
}

export function moveSheetWidget(
  pack: PresentationPack,
  widgetId: string,
  slot: PresentationSlot,
): PresentationPack {
  const target = pack.widgets.find((w) => w.id === widgetId);
  if (!target) return pack;
  const order =
    pack.widgets
      .filter((w) => w.slot === slot && w.id !== widgetId)
      .reduce((m, w) => Math.max(m, w.order), -1) + 1;
  return {
    ...pack,
    widgets: pack.widgets.map((w) =>
      w.id === widgetId ? { ...w, slot, order } : w,
    ),
  };
}

export function removeSheetWidget(
  pack: PresentationPack,
  widgetId: string,
): PresentationPack {
  return {
    ...pack,
    widgets: pack.widgets.filter((w) => w.id !== widgetId),
  };
}

export function setSheetTheme(
  pack: PresentationPack,
  theme: PresentationTheme,
): PresentationPack {
  return { ...pack, theme };
}

export function setSheetPen(
  pack: PresentationPack,
  pen: PresentationPen,
): PresentationPack {
  return { ...pack, pen };
}

export function setSheetAtmosphere(
  pack: PresentationPack,
  atmosphere: AtmospherePigment,
): PresentationPack {
  return { ...pack, atmosphere };
}

export function atmospherePigmentHex(id: AtmospherePigment): string {
  return (
    ATMOSPHERE_PIGMENT_SWATCHES.find((p) => p.id === id)?.hex ?? "#5c5a56"
  );
}

/**
 * Auto-format — Beautiful.ai-style priority reflow into slots.
 * Deterministic; safe to call as HITL “Reflow”.
 */
export function reflowSheetWidgets(pack: PresentationPack): PresentationPack {
  const priority: Record<PresentationWidgetType, number> = {
    caption: 0,
    quote_total: 1,
    savings_ledger: 2,
    zone_summary: 3,
    material_swatches: 4,
    honesty_footer: 5,
  };
  const preferredSlot: Record<PresentationWidgetType, PresentationSlot> = {
    caption: "title_meta",
    quote_total: "side_stack",
    savings_ledger: "side_stack",
    zone_summary: "side_stack",
    material_swatches: "footer_band",
    honesty_footer: "footer_band",
  };

  const sorted = [...pack.widgets].sort(
    (a, b) => priority[a.type] - priority[b.type],
  );
  const counters: Record<PresentationSlot, number> = {
    title_meta: 0,
    side_stack: 0,
    footer_band: 0,
  };
  const widgets = sorted.map((w) => {
    const slot = preferredSlot[w.type];
    const order = counters[slot];
    counters[slot] += 1;
    return { ...w, slot, order };
  });
  return { ...pack, widgets };
}

export function widgetsInSlot(
  pack: PresentationPack,
  slot: PresentationSlot,
): PresentationWidget[] {
  return pack.widgets
    .filter((w) => w.slot === slot)
    .sort((a, b) => a.order - b.order);
}
