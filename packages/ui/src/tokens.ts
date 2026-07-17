/** Workstream Design System 3.0 — soft-pink editorial, canvas-first. */
export const tokens = {
  color: {
    surface: {
      base: "#F3ECEF",
      elevated: "#FFF9FB",
      sunken: "#E8DFE4",
      inverted: "#1A1218",
    },
    ink: {
      primary: "#1A1218",
      secondary: "#5C4A52",
      tertiary: "#8A7580",
      inverted: "#FAF4F6",
    },
    line: {
      hairline: "#E0D4DA",
      strong: "#C9B6BF",
      ink: "#1A1218",
    },
    accent: {
      default: "#D4849A",
      soft: "#F7DCE4",
      ink: "#7A3348",
      bright: "#F0B4C4",
    },
    semantic: {
      ok: "#3D8B6E",
      warn: "#B8893A",
      block: "#B42318",
      info: "#8B6B7A",
    },
  },

  font: {
    display: "Fraunces",
    body: "Sora",
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
    sm: 10,
    md: 14,
    lg: 20,
    canvas: 16,
    pill: 999,
  },

  elevation: {
    1: {
      shadowOffset: { width: 0, height: 1 },
      shadowRadius: 0,
      shadowOpacity: 0.05,
      shadowColor: "#1A1218",
      elevation: 1,
    },
    2: {
      shadowOffset: { width: 0, height: 18 },
      shadowRadius: 48,
      shadowOpacity: 0.09,
      shadowColor: "#1A1218",
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
