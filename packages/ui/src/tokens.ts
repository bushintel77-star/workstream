export const tokens = {
  color: {
    surface: {
      base: '#FAFAF7',
      elevated: '#FFFFFF',
      sunken: '#F4F4F1',
      inverted: '#18181B',
    },
    ink: {
      primary: '#18181B',
      secondary: '#52525B',
      tertiary: '#A1A1AA',
      inverted: '#FAFAF7',
    },
    line: {
      hairline: '#E4E4E7',
      strong: '#D4D4D8',
      ink: '#18181B',
    },
    accent: {
      default: '#C2410C',
      soft: '#FED7AA',
      ink: '#7C2D12',
    },
    semantic: {
      ok: '#15803D',
      warn: '#B45309',
      block: '#B91C1C',
      info: '#1D4ED8',
    },
  },

  font: {
    display: 'Inter Display',
    body: 'Inter',
    mono: 'JetBrains Mono',
  },

  type: {
    displayL: {
      fontSize: 32,
      lineHeight: 36,
      letterSpacing: -0.02 * 32,
      fontWeight: '600' as const,
    },
    displayM: {
      fontSize: 24,
      lineHeight: 28,
      letterSpacing: -0.01 * 24,
      fontWeight: '600' as const,
    },
    title: {
      fontSize: 18,
      lineHeight: 24,
      letterSpacing: 0,
      fontWeight: '600' as const,
    },
    body: {
      fontSize: 15,
      lineHeight: 22,
      letterSpacing: 0,
      fontWeight: '400' as const,
    },
    bodyMono: {
      fontSize: 14,
      lineHeight: 22,
      letterSpacing: 0,
      fontWeight: '500' as const,
    },
    caption: {
      fontSize: 13,
      lineHeight: 18,
      letterSpacing: 0,
      fontWeight: '500' as const,
    },
    micro: {
      fontSize: 11,
      lineHeight: 14,
      letterSpacing: 0.04 * 11,
      fontWeight: '600' as const,
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
    sm: 4,
    md: 8,
    lg: 12,
    pill: 999,
  },

  elevation: {
    1: {
      shadowOffset: { width: 0, height: 1 },
      shadowRadius: 2,
      shadowOpacity: 0.06,
      shadowColor: '#18181B',
      elevation: 1,
    },
    2: {
      shadowOffset: { width: 0, height: 8 },
      shadowRadius: 24,
      shadowOpacity: 0.08,
      shadowColor: '#18181B',
      elevation: 4,
    },
  },

  motion: {
    easeStandard: { x1: 0.2, y1: 0, x2: 0, y2: 1 },
    easeEmphasis: { x1: 0.2, y1: 0, x2: 0.2, y2: 1 },
    durFast: 120,
    durBase: 200,
    durSlow: 320,
  },
} as const;
