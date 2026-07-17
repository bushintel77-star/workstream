export const tokens = {
  color: {
    surface: {
      base: "#E5ECE7",
      elevated: "#F8FBF9",
      sunken: "#D4DDD7",
      inverted: "#0C1A14",
    },
    ink: {
      primary: "#0C1A14",
      secondary: "#3A4D42",
      tertiary: "#6B7D72",
      inverted: "#F2F7F4",
    },
    line: {
      hairline: "#C2CDC6",
      strong: "#9AABA0",
      ink: "#0C1A14",
    },
    accent: {
      default: "#1F8A5A",
      soft: "#D0EDDD",
      ink: "#0E3F28",
    },
    semantic: {
      ok: "#178A4A",
      warn: "#9A7218",
      block: "#B42318",
      info: "#2F7D8C",
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
    sm: 8,
    md: 12,
    lg: 18,
    pill: 999,
  },

  elevation: {
    1: {
      shadowOffset: { width: 0, height: 1 },
      shadowRadius: 0,
      shadowOpacity: 0.05,
      shadowColor: "#0C1A14",
      elevation: 1,
    },
    2: {
      shadowOffset: { width: 0, height: 18 },
      shadowRadius: 48,
      shadowOpacity: 0.09,
      shadowColor: "#0C1A14",
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
