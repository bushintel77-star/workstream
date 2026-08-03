/**
 * AI capability cues — surfacing what the assistant can actually do, at the
 * moment it can do it.
 *
 * ## The problem this solves
 *
 * The studio AI is substantial: vision-based canopy detection over aerial
 * imagery, freehand-sketch-to-CAD interpretation, layout proposals, a
 * session-rejection feedback loop, and a second self-audit model pass. All of it
 * reaches the operator as the words "Ask AI" in the header rail, at the same
 * visual weight as a grid toggle. Nobody opening the studio cold would know any
 * of those capabilities exist.
 *
 * `docs/STUDIO-STYLING-AND-UX.md` §6 already forbids the obvious fix and
 * prescribes this one:
 *
 *   item 9  — "the ribbon is a fixed budget, not a landing strip — a new
 *              top-level toggle needs the same justification as a new page"
 *   item 10 — "discoverable in context (hint pill on first relevant action,
 *              Cmd+K entry, cursor affordance) instead of relying on the user
 *              noticing a new icon"
 *   item 11 — "degrade invisibly — off state indistinguishable from the app
 *              before the feature existed"
 *
 * So: no new buttons. A cue appears only when a specific capability becomes
 * newly *useful*, names it in plain words, offers one action, and never returns
 * once acknowledged.
 *
 * The house precedent is the Sketch dock's formalize bar — "1 stroke · tidy
 * stays hand-drawn · formalize when ready". Same idiom, applied to the
 * capabilities that currently have no surface at all.
 *
 * ## Scope
 *
 * Only capabilities with **no existing affordance** get a cue:
 *
 *   canopy — vision tree detection. No surface today.
 *   layout — AI layout proposal. No surface today.
 *
 * Deliberately excluded: sketch-to-CAD already has the formalize bar; ghost
 * review already drives the header pill's `hot` state; free-form assist is the
 * header pill itself. Cueing those would be redundant chrome, which §6 item 11
 * exists to prevent.
 *
 * This module is pure — no React, no storage, no side effects — so the policy
 * can be tested without a DOM.
 */

/**
 * These are *moments*, not separate engine calls.
 *
 * Both dispatch `ai.scan()` — `scanGhosts` in `useStudioState` sets
 * `canopyScanning`, calls `scanDesignGhostsAction`, and folds in
 * `proposeLayoutFromSnapshot` in a single pass. What differs is what the pass
 * will usefully find given the state of the canvas, and therefore what is
 * honest to promise the operator. Cueing "scan canopy" on a lot with no aerial
 * would be a lie; cueing "propose a layout" over a finished plan would be
 * presumptuous.
 */
export type AiCapabilityId = "canopy" | "layout";

export type AiCapability = {
  id: AiCapabilityId;
  /** Plain-language outcome. Never a feature name. */
  title: string;
  /** What happens, and the honesty promise that nothing auto-commits. */
  body: string;
  /** Verb on the action button. */
  action: string;
};

export const AI_CAPABILITIES: Record<AiCapabilityId, AiCapability> = {
  canopy: {
    id: "canopy",
    title: "Find the existing trees for you",
    body: "The assistant can read canopies off the aerial and place them as ghosts. Nothing lands on the plan until you accept it.",
    action: "Scan the aerial",
  },
  layout: {
    id: "layout",
    title: "Draft a first layout",
    body: "With the lot traced, the assistant can propose beds, paving and planting as ghosts you edit or reject.",
    action: "Propose a layout",
  },
};

/**
 * Everything the policy needs. Deliberately primitives rather than the studio
 * snapshot — it keeps the rules readable and the tests free of fixtures.
 */
export type AiCueContext = {
  /** Cues belong to the drawing modes; Quote/Present/Share are not canvases. */
  mode: string;
  /** Aerial imagery loaded — precondition for canopy vision. */
  hasAerial: boolean;
  /** Boundary vertices. A closed lot needs at least 3. */
  boundaryPoints: number;
  /** Placed items of any kind. */
  itemCount: number;
  /** Placed trees specifically. */
  treeCount: number;
  /** Unreviewed AI ghosts. */
  ghostCount: number;
  /** AI mid-flight — scanning or assisting. */
  aiBusy: boolean;
  /** Presentation-ish states where all teaching chrome is wrong. */
  clientView: boolean;
  focusOn: boolean;
  frameOn: boolean;
  /** Capabilities the operator has already acknowledged on this project. */
  seen: readonly AiCapabilityId[];
};

const DRAWING_MODES = new Set(["survey", "sketch", "cad"]);

/**
 * Which capability, if any, to cue right now. `null` means render nothing —
 * which is the answer most of the time, and is the point.
 *
 * Order matters: canopy first, because reading the existing site precedes
 * proposing a design for it. Only ever one cue at a time; stacked teaching
 * chrome is the thing §6 item 11 forbids.
 */
export function nextAiCue(ctx: AiCueContext): AiCapability | null {
  // Presentation and focus states: the drawing is being read, not authored.
  if (ctx.clientView || ctx.focusOn || ctx.frameOn) return null;
  // Not a drawing surface.
  if (!DRAWING_MODES.has(ctx.mode)) return null;
  // Mid-flight — the busy state is its own signal, don't talk over it.
  if (ctx.aiBusy) return null;
  // Ghosts pending: the operator already has an AI decision in front of them.
  // A second AI prompt here competes with the one that matters.
  if (ctx.ghostCount > 0) return null;

  const unseen = (id: AiCapabilityId) => !ctx.seen.includes(id);

  // Canopy — an aerial exists and no trees have been recorded, so the vision
  // pass has something to find and nothing to duplicate.
  if (unseen("canopy") && ctx.hasAerial && ctx.treeCount === 0) {
    return AI_CAPABILITIES.canopy;
  }

  // Layout — the lot is closed but empty. Proposing into an already-designed
  // plan is presumptuous; proposing into an empty one is the useful case.
  if (unseen("layout") && ctx.boundaryPoints >= 3 && ctx.itemCount === 0) {
    return AI_CAPABILITIES.layout;
  }

  return null;
}

/** Storage key — per project, so a cue dismissed on one site still teaches on the next. */
export function aiCueStorageKey(projectId: string): string {
  return `cc_ai_cue_seen:${projectId}`;
}

/** Parse persisted acknowledgements, tolerating anything malformed. */
export function parseSeen(raw: string | null): AiCapabilityId[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (v): v is AiCapabilityId => v === "canopy" || v === "layout",
    );
  } catch {
    return [];
  }
}
