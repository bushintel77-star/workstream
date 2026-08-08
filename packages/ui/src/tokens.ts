/**
 * Workstream Design System 4.0 — unified dark-grey identity.
 * One token source consumed by both apps/mobile (RN) and apps/web (CSS alias).
 * Palette aligned with web --gray-d-* / --surface-deep system.
 * Studio frame is the brand identity: dark grey gallery mount, cream plan is the subject.
 */
export const tokens = {
  color: {
    surface: {
      /** Darkest — full-screen backgrounds, studio frame, app shell */
      base: "#14171C",
      /** Raised cards, sheets, panels sitting above base */
      elevated: "#1B1E24",
      /** Recessed inputs, wells, sunken states */
      sunken: "#0F1115",
      /** Inverted text on dark surfaces */
      inverted: "#E8E9EC",
    },
    ink: {
      /** Primary text on dark surfaces */
      primary: "#E8E9EC",
      /** Secondary text — metadata, captions */
      secondary: "#9AA0AC",
      /** Tertiary — placeholders, disabled */
      tertiary: "#6B7078",
      /** Inverted text on light surfaces (portal sheet, plan) */
      inverted: "#1B1E23",
    },
    line: {
      hairline: "#2A2D34",
      strong: "#3A3E46",
      ink: "#E8E9EC",
    },
    accent: {
      /** Blueprint slate — matches web --accent (#4f6a89) */
      default: "#5A789B",
      soft: "#1E2A38",
      ink: "#8BA4C4",
      bright: "#7B9BC4",
    },
    semantic: {
      ok: "#4C9662",
      warn: "#D4A017",
      block: "#C4463B",
      info: "#6E93E0",
    },
  },

  font: {
    display: "IBM Plex Mono",
    body: "IBM Plex Sans",
    serif: "IBM Plex Serif",
    mono: "IBM Plex Mono",
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
      shadowColor: "#000000",
      elevation: 1,
    },
    2: {
      shadowOffset: { width: 0, height: 18 },
      shadowRadius: 48,
      shadowOpacity: 0.14,
      shadowColor: "#000000",
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
