/**
 * Workstream Design System — one namespace, shared by apps/mobile (RN, this
 * file) and apps/web (`styles/tokens.css`, `--ws-*`). Every value below
 * resolves to the `--ws-*` token named beside it; `scripts/check-ui-token-
 * parity.mjs` reads both files and fails CI if they drift apart.
 *
 * The chrome is opaque, dead-neutral and dark: `surface.elevated` /
 * `#16191C` is the panel plastic, `ink.primary` / `#E8EAEC` is primary text.
 * `accent.*` signals state with LUMINANCE (a light fill, dark ink) rather
 * than a hue, so the entire spectrum stays free for drawing/field content —
 * `studio.signalBlue` / `#0030CF` (survey truth) and `semantic.block` /
 * `#D2564F` (conflict) are the only saturated colours left in the chrome.
 *
 * This replaced the previous light "Studio Paper" palette (white panels,
 * Signal Blue `#3D5AFE` accent) when apps/web collapsed three divergent
 * chrome systems into one; mobile's values were repointed to match rather
 * than left to diverge, per the same "one design system" decision.
 */
export const tokens = {
  color: {
    surface: {
      /** App shell background — web `--ws-panel-sunken` */
      base: "#101314",
      /** Raised cards, sheets, panels — `--ws-panel` */
      elevated: "#16191C",
      /** Recessed inputs, wells, sunken states — `--ws-panel-sunken` */
      sunken: "#101314",
      /** Light inverted surfaces (chips on the dark chrome) — `--ws-ink` */
      inverted: "#E8EAEC",
    },
    ink: {
      /** Primary text on panel — `--ws-ink` (13.9:1 on panel) */
      primary: "#E8EAEC",
      /** Secondary text, labels — `--ws-ink-secondary` (8.2:1) */
      secondary: "#B3B9BF",
      /** Tertiary — placeholders, disabled — `--ws-ink-muted` (5.1:1) */
      tertiary: "#878F96",
      /** Ink on the light active fill — `--ws-active-ink` */
      inverted: "#0D0F11",
      /**
       * Field-screen body on `surface.inverted` — this and `invertedTertiary`
       * predate the mobile/web unification and have no `--ws-*` counterpart
       * (web has no dark-on-light field screens to pair against). Left as
       * documented mobile-only in check-ui-token-parity.mjs.
       */
      invertedSecondary: "rgba(255, 255, 255, 0.72)",
      /** Field-screen captions/labels on `surface.inverted` (mobile-only, see above) */
      invertedTertiary: "rgba(255, 255, 255, 0.55)",
    },
    line: {
      /** Decorative hairline — web `--line-hairline` = color-mix(var(--ws-line) 55%);
       *  --ws-line is itself rgba(...,0.14), so the painted alpha is
       *  0.14 x 0.55 = 0.077. */
      hairline: "rgba(232, 234, 236, 0.077)",
      /** Interactive boundaries — `--ws-line-strong` */
      strong: "rgba(232, 234, 236, 0.28)",
      ink: "#E8EAEC",
    },
    accent: {
      /** Active/selected chrome — a light fill, not a hue (`--ws-active`) */
      default: "#E8EAEC",
      /** Resting tint for an armed-but-not-active control — `--ws-active-quiet` */
      soft: "rgba(232, 234, 236, 0.08)",
      /** `--ws-active` used as text */
      ink: "#E8EAEC",
      /** Brighter hover/pressed step — `--ws-active-bright` */
      bright: "#F2F0EA",
    },
    semantic: {
      /** Status is ink + iconography; colour reserved for critical — `--ws-success` */
      ok: "#B3B9BF",
      /** Caution — `--ws-warning` (amber, was ink-grey) */
      warn: "#D9A441",
      /** Strike/conflict — `--ws-conflict` */
      block: "#D2564F",
      /** `--ws-ink-secondary` */
      info: "#B3B9BF",
    },
    /**
     * Legacy dialect keys (`gold`, `signalBlue`) alias the canonical
     * `--ws-active*` / `--ws-dwg-truth*` mirrors below them — same values,
     * kept for call sites written before the mirrors existed. Used for the
     * plant discovery/placement interaction language (AI-optimized
     * highlight, site-truth anchor, conflict state).
     */
    studio: {
      /** AI-optimized highlight / active ring — `--ws-active` */
      gold: "#E8EAEC",
      /** Ink on the active fill — `--ws-active-ink` */
      goldInk: "#0D0F11",
      /** Site-truth anchor (cobalt) — `--ws-dwg-truth` */
      signalBlue: "#0030CF",
      /** Cobalt label text — `--ws-dwg-truth-ink` */
      signalBlueInk: "#2450C7",
      /** Strike Alert — `--ws-conflict` */
      conflict: "#D2564F",
      /** Conflict veil — `--ws-conflict-veil` (16%) */
      conflictSoft: "rgba(210, 86, 79, 0.16)",
      /** Canonical mirrors for new code — `--ws-active*` */
      primary: "#E8EAEC",
      primaryHover: "#F2F0EA",
      primaryPressed: "#F2F0EA",
      primaryInk: "#0D0F11",
      primaryQuiet: "rgba(232, 234, 236, 0.08)",
      /** Canonical mirrors for new code — `--ws-dwg-truth*` */
      truth: "#0030CF",
      truthInk: "#2450C7",
    },
  },

  font: {
    /** Technical/numeric — Space Grotesk (`--font-tech`) */
    display: "Space Grotesk",
    /** UI chrome — Inter (`--font-ui`) */
    body: "Inter",
    /** Editorial/deck serif — Inter for chrome (Fraunces is client-deck only) */
    serif: "Inter",
    /** Technical/numeric mono role — Space Grotesk */
    mono: "Space Grotesk",
  },

  type: {
    displayL: {
      fontSize: 32,
      lineHeight: 36,
      letterSpacing: -0.02 * 32,
      fontWeight: "600" as const,
    },
    displayM: {
      fontSize: 24,
      lineHeight: 28,
      letterSpacing: -0.015 * 24,
      fontWeight: "600" as const,
    },
    title: {
      fontSize: 18,
      lineHeight: 24,
      letterSpacing: -0.01 * 18,
      fontWeight: "600" as const,
    },
    body: {
      fontSize: 15,
      lineHeight: 22,
      letterSpacing: 0,
      fontWeight: "400" as const,
    },
    bodyMono: {
      fontSize: 14,
      lineHeight: 22,
      letterSpacing: 0,
      fontWeight: "500" as const,
    },
    caption: {
      fontSize: 13,
      lineHeight: 18,
      letterSpacing: 0,
      fontWeight: "500" as const,
    },
    micro: {
      fontSize: 11,
      lineHeight: 14,
      letterSpacing: 0.04 * 11,
      fontWeight: "600" as const,
    },
  },

  space: {
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 24,
    6: 32,
    7: 48,
    8: 64,
  },

  radius: {
    sm: 5,
    md: 7,
    lg: 10,
    xl: 14,
    canvas: 8,
    pill: 999,
  },

  elevation: {
    1: {
      shadowOffset: { width: 0, height: 1 },
      shadowRadius: 0,
      shadowOpacity: 0.08,
      shadowColor: "#111111",
      elevation: 1,
    },
    2: {
      shadowOffset: { width: 0, height: 18 },
      shadowRadius: 48,
      shadowOpacity: 0.14,
      shadowColor: "#111111",
      elevation: 4,
    },
  },

  motion: {
    easeStandard: { x1: 0.22, y1: 1, x2: 0.36, y2: 1 },
    easeEmphasis: { x1: 0.16, y1: 1, x2: 0.3, y2: 1 },
    durFast: 140,
    durBase: 260,
    durSlow: 480,
  },
} as const;
