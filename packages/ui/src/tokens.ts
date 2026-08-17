/**
 * Workstream Design System — Studio Paper (2026 pivot).
 * One token source consumed by apps/mobile (RN). apps/web has its own CSS
 * mirror (`styles/color-tokens.css` + `globals.css`) that this file tracks:
 * every value below resolves to a token in docs/GOLD-STANDARD-2026-TOKENS.md,
 * the supreme binding spec.
 *
 * Studio Paper: high-key dead-neutral workspace, Signal Blue `#3D5AFE` as the
 * sole UI accent, crimson `#C41E1E` for conflict/strike only, cobalt `#0030CF`
 * as drawing data. Gold is retired from chrome (the legacy `studio.gold*`
 * dialect keys now alias Signal Blue, exactly as web's `--gold-standard`
 * aliases `--gs-primary`). The old Studio Dark default is dead.
 *
 * Dark surfaces survive only as the charcoal vocabulary (`surface.inverted` =
 * `--gs-ink`), used by the deliberate field screens (grid-soil, recording)
 * and charcoal chips — never the drawing surface.
 */
export const tokens = {
  color: {
    surface: {
      /** App shell background — web `--surface-base` (`--gs-glass-sunken`) */
      base: "#EBEBEB",
      /** Raised cards, sheets, panels — `--gs-panel` */
      elevated: "#FFFFFF",
      /** Recessed inputs, wells, sunken states — `--gs-frame` */
      sunken: "#E4E4E4",
      /** Charcoal inverted surfaces (field screens, chips) — `--gs-ink` */
      inverted: "#1A1A1A",
    },
    ink: {
      /** Primary text on paper — `--gs-ink` (17.41:1 on panel) */
      primary: "#1A1A1A",
      /** Secondary text, labels — `--gs-ink-secondary` (7.82:1) */
      secondary: "#525252",
      /** Tertiary — placeholders, disabled — `--gs-ink-muted` (>=4.72:1) */
      tertiary: "#636363",
      /** Ink on charcoal/primary fills — `--gs-chip-active-ink` / `--gs-gold-ink` */
      inverted: "#FFFFFF",
      /**
       * Field-screen body on `surface.inverted` (~4.9:1 on charcoal).
       * Companion to the white/charcoal chip vocabulary; no dark-screen
       * equivalent exists in the web spec because web has no dark screens.
       */
      invertedSecondary: "rgba(255, 255, 255, 0.72)",
      /** Field-screen captions/labels on `surface.inverted` (~3.6:1, micro/AA-exempt) */
      invertedTertiary: "rgba(255, 255, 255, 0.55)",
    },
    line: {
      /** Decorative hairline — `--gs-line` at 55% (web `--line-hairline`) */
      hairline: "rgba(212, 212, 212, 0.55)",
      /** Interactive boundaries — `--gs-line-strong` (3.36:1 on panel) */
      strong: "#8C8C8C",
      ink: "#1A1A1A",
    },
    accent: {
      /** Signal Blue base — CTA fill, active tool state, focus rings (`--gs-primary`) */
      default: "#3D5AFE",
      /** Resting blue fills/borders — `--gs-primary-quiet` */
      soft: "#D9E0FC",
      /** Blue as text on paper — `--gs-primary-ink` (7.97:1) */
      ink: "#2340C8",
      /** Blue hover — `--gs-primary-hover` */
      bright: "#4D6BFE",
    },
    semantic: {
      /** Status is ink + iconography; colour reserved for critical — `--gs-success` */
      ok: "#525252",
      /** Same law as ok — `--gs-warning` */
      warn: "#525252",
      /** Strike/conflict crimson — `--gs-conflict` */
      block: "#C41E1E",
      /** `--info` alias of `--gs-ink-secondary` */
      info: "#525252",
    },
    /**
     * Gold Standard studio accents. The legacy dialect keys (`gold`,
     * `signalBlue`) resolve exactly as apps/web's `globals.css` aliases:
     * `--gold-standard` → `--gs-primary`, `--signal-blue` → `--gs-truth`,
     * `--gs-conflict` → crimson. Used for the plant discovery/placement
     * interaction language (AI-optimized highlight, site-truth anchor,
     * conflict state) — not a full re-theme of mobile surfaces.
     */
    studio: {
      /** AI-optimized highlight / active ring — `--gold-standard` → `--gs-primary` */
      gold: "#3D5AFE",
      /** Ink on primary-filled chips/buttons — `--gold-standard-ink-bright` */
      goldInk: "#FFFFFF",
      /** Site-truth anchor (cobalt) — `--signal-blue` → `--gs-truth` */
      signalBlue: "#0030CF",
      /** Cobalt label text on paper — `--signal-blue-ink` → `--gs-truth-ink` */
      signalBlueInk: "#2450C7",
      /** Strike Alert — `--gs-conflict` */
      conflict: "#C41E1E",
      /** Conflict veil — `--gs-conflict-veil` (16%) */
      conflictSoft: "rgba(196, 30, 30, 0.16)",
      /** Canonical mirrors for new code — `--gs-primary*` */
      primary: "#3D5AFE",
      primaryHover: "#4D6BFE",
      primaryPressed: "#2946C8",
      primaryInk: "#2340C8",
      primaryQuiet: "#D9E0FC",
      /** Canonical mirrors for new code — `--gs-truth*` */
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
