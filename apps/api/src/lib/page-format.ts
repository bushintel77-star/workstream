import type {
  PanelRect,
  PresentationDeliverableType,
  PresentationFormatGhost,
  PresentationFormatRequest,
  PresentationFormatResponse,
  PresentationTemplateId,
} from "@workstream/contracts";

/**
 * AI editorial formatting — propose a layout (rect per panel) for a page given
 * the deliverable type + template. Title-centric (brief §5.1): the site truth
 * leads the composition.
 *
 * Heuristic-first (deterministic, testable without mocking Claude). The
 * formatter arranges panels into template slots in the Curtis house style:
 * - Design blurb block (heading/subheading text)
 * - Four drawing squares (plan crops, images)
 * - Labour + product schedule (widgets, swatch boards)
 *
 * Ghosts are ephemeral: the caller returns them to the client for review.
 * Acceptance applies the rects to the panels via the document PUT.
 */

// --- Template slot layouts (page content area, 0-100 %) ---

type Slot = { rect: PanelRect; role: SlotRole };
type SlotRole =
  | "hero" // Large feature drawing (plan overview, hero image)
  | "drawing" // One of the four drawing squares
  | "blurb" // Heading / subheading / body text block
  | "schedule" // Widget / swatch board (labour + product schedule)
  | "caption"; // Small text / caption / footer

/**
 * Each template defines a set of named slots with rects in % of the page
 * content area. The formatter assigns panels to slots by kind + role priority.
 */
function templateSlots(
  templateId: PresentationTemplateId,
): Slot[] {
  switch (templateId) {
    case "editorial_classic":
      // Title strip top, four drawing squares centre, schedule bottom
      return [
        { role: "blurb", rect: { x_pct: 5, y_pct: 4, w_pct: 90, h_pct: 10 } },
        { role: "hero", rect: { x_pct: 5, y_pct: 16, w_pct: 55, h_pct: 48 } },
        { role: "drawing", rect: { x_pct: 62, y_pct: 16, w_pct: 33, h_pct: 23 } },
        { role: "drawing", rect: { x_pct: 62, y_pct: 41, w_pct: 33, h_pct: 23 } },
        { role: "schedule", rect: { x_pct: 5, y_pct: 66, w_pct: 55, h_pct: 30 } },
        { role: "schedule", rect: { x_pct: 62, y_pct: 66, w_pct: 33, h_pct: 30 } },
      ];

    case "editorial_minimal":
      // Single hero drawing, minimal text, generous whitespace
      return [
        { role: "blurb", rect: { x_pct: 8, y_pct: 5, w_pct: 84, h_pct: 8 } },
        { role: "hero", rect: { x_pct: 8, y_pct: 16, w_pct: 84, h_pct: 58 } },
        { role: "caption", rect: { x_pct: 8, y_pct: 76, w_pct: 84, h_pct: 18 } },
      ];

    case "editorial_feature":
      // Asymmetric: large feature drawing left, stacked content right
      return [
        { role: "blurb", rect: { x_pct: 5, y_pct: 4, w_pct: 40, h_pct: 10 } },
        { role: "hero", rect: { x_pct: 5, y_pct: 16, w_pct: 52, h_pct: 80 } },
        { role: "drawing", rect: { x_pct: 60, y_pct: 16, w_pct: 35, h_pct: 25 } },
        { role: "drawing", rect: { x_pct: 60, y_pct: 43, w_pct: 35, h_pct: 25 } },
        { role: "schedule", rect: { x_pct: 60, y_pct: 70, w_pct: 35, h_pct: 26 } },
      ];

    case "editorial_schedule":
      // Schedule-heavy: quotation layout — schedule top, drawings bottom
      return [
        { role: "blurb", rect: { x_pct: 5, y_pct: 4, w_pct: 90, h_pct: 8 } },
        { role: "schedule", rect: { x_pct: 5, y_pct: 14, w_pct: 90, h_pct: 45 } },
        { role: "drawing", rect: { x_pct: 5, y_pct: 61, w_pct: 43, h_pct: 35 } },
        { role: "drawing", rect: { x_pct: 52, y_pct: 61, w_pct: 43, h_pct: 35 } },
      ];
  }
}

// --- Deliverable-type slot priorities ---

/**
 * Each deliverable type has a different slot priority order — which roles
 * get filled first when there are more panels than slots.
 */
function slotPriority(
  deliverable: PresentationDeliverableType,
): Record<SlotRole, number> {
  switch (deliverable) {
    case "deck":
      // Client deck: hero drawing first, then blurb, then feature drawings
      return { hero: 0, blurb: 1, drawing: 2, schedule: 3, caption: 4 };
    case "quotation":
      // Quote: schedule (pricing) first, then blurb, then drawings
      return { schedule: 0, blurb: 1, drawing: 2, hero: 3, caption: 4 };
    case "mood_board":
      // Mood board: drawings (imagery) first, then captions
      return { drawing: 0, hero: 1, caption: 2, blurb: 3, schedule: 4 };
    case "concept_sketch":
      // Concept: hero sketch first, then blurb, then captions
      return { hero: 0, blurb: 1, caption: 2, drawing: 3, schedule: 4 };
  }
}

// --- Panel → slot assignment ---

/**
 * Determine which slot role a panel should fill based on its kind + metadata.
 */
function panelSlotRole(
  panel: PresentationFormatRequest["panels"][number],
): SlotRole {
  // Text panels: heading/subheading → blurb, body → blurb, caption → caption
  if (panel.kind === "text") {
    if (panel.role === "caption") return "caption";
    return "blurb";
  }
  // Plan crop: overview → hero, others → drawing
  if (panel.kind === "plan_crop") {
    if (panel.reason === "overview") return "hero";
    return "drawing";
  }
  // Image → drawing (or hero if no plan overview)
  if (panel.kind === "image") return "drawing";
  // Widget → schedule
  if (panel.kind === "widget") return "schedule";
  // Swatch board → schedule (mood board material grid)
  if (panel.kind === "swatch_board") return "schedule";
  return "drawing";
}

/**
 * Assign panels to template slots. Greedy: sort panels by slot-role priority,
 * then fill slots in template order, matching panel roles to slot roles.
 * Panels that don't find a matching slot get a fallback grid position.
 */
function assignPanelsToSlots(
  panels: PresentationFormatRequest["panels"],
  templateId: PresentationTemplateId,
  deliverable: PresentationDeliverableType,
): { panelId: string; slot: Slot; rationale: string }[] {
  const slots = templateSlots(templateId);
  const priority = slotPriority(deliverable);

  // Sort panels by deliverable-priority of their target slot role
  const sortedPanels = [...panels].sort((a, b) => {
    const pa = priority[panelSlotRole(a)];
    const pb = priority[panelSlotRole(b)];
    return pa - pb;
  });

  const assignments: { panelId: string; slot: Slot; rationale: string }[] = [];
  const usedSlots = new Set<number>();
  const unassigned: typeof sortedPanels = [];

  // First pass: match panels to slots by role
  for (const panel of sortedPanels) {
    const role = panelSlotRole(panel);
    // Find the first unused slot with a matching role
    const slotIdx = slots.findIndex(
      (s, i) => !usedSlots.has(i) && s.role === role,
    );
    if (slotIdx >= 0) {
      usedSlots.add(slotIdx);
      assignments.push({
        panelId: panel.id,
        slot: slots[slotIdx]!,
        rationale: `${panel.kind} → ${role} slot`,
      });
    } else {
      unassigned.push(panel);
    }
  }

  // Second pass: fill remaining slots with unassigned panels (any role)
  for (const panel of unassigned) {
    const slotIdx = slots.findIndex((_, i) => !usedSlots.has(i));
    if (slotIdx >= 0) {
      usedSlots.add(slotIdx);
      assignments.push({
        panelId: panel.id,
        slot: slots[slotIdx]!,
        rationale: `${panel.kind} → fallback ${slots[slotIdx]!.role} slot`,
      });
    }
  }

  // Third pass: any panels still unassigned get a grid position below the slots
  const stillUnassigned = unassigned.filter(
    (p) => !assignments.some((a) => a.panelId === p.id),
  );
  for (const panel of stillUnassigned) {
    const idx = assignments.length;
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    assignments.push({
      panelId: panel.id,
      slot: {
        rect: {
          x_pct: 5 + col * 31,
          y_pct: 5 + row * 20,
          w_pct: 28,
          h_pct: 18,
        },
        role: "drawing",
      },
      rationale: `${panel.kind} → overflow grid`,
    });
  }

  return assignments;
}

/**
 * Format a page: propose a layout (rect per panel) for the given panels +
 * deliverable type + template. Pure function — no side effects, no I/O.
 */
export function formatPageLayout(
  request: PresentationFormatRequest,
): PresentationFormatResponse {
  if (request.panels.length === 0) {
    return { ghosts: [], rationale: "No panels to lay out.", source: "heuristic" };
  }

  const assignments = assignPanelsToSlots(
    request.panels,
    request.template_id,
    request.deliverable_type,
  );

  const ghosts: PresentationFormatGhost[] = assignments.map((a) => ({
    id: a.panelId,
    rect: a.slot.rect,
    rationale: a.rationale,
  }));

  const rationale = `${request.template_id} layout for ${request.deliverable_type}: ${assignments.length} panel(s) placed into template slots.`;

  return { ghosts, rationale, source: "heuristic" };
}
