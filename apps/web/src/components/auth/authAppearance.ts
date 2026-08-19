/**
 * Clerk auth appearance — Gold Standard Studio Paper applied to the
 * sign-in / sign-up surfaces. Clerk renders its own DOM with inline
 * styles, so values resolve from the token module (never raw literals).
 */

import type { ComponentProps } from "react";
import type { SignIn } from "@clerk/nextjs";
import { PALETTE } from "../../styles/colorTokens";

type ClerkAppearance = NonNullable<
  ComponentProps<typeof SignIn>["appearance"]
>;

export const authAppearance: ClerkAppearance = {
  variables: {
    colorPrimary: PALETTE.gsPrimary,
    colorText: PALETTE.gsInk,
    colorTextSecondary: PALETTE.gsInkSecondary,
    colorBackground: PALETTE.gsPanel,
    colorInputBackground: PALETTE.gsPanel,
    colorInputText: PALETTE.gsInk,
    colorDanger: PALETTE.gsConflict,
    borderRadius: "10px",
    fontFamily:
      "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    spacingUnit: "0.2rem",
  },
  elements: {
    rootBox: {
      width: "100%",
    },
    card: {
      borderRadius: "24px",
      border: `1px solid ${PALETTE.gsLine}`,
      boxShadow:
        "0 12px 32px rgb(17 17 17 / 14%), 0 2px 6px rgb(17 17 17 / 8%)",
    },
    headerTitle: {
      fontFamily: "Space Grotesk, Inter, sans-serif",
      fontWeight: 600,
      letterSpacing: "-0.01em",
      color: PALETTE.gsInk,
    },
    headerSubtitle: {
      color: PALETTE.gsInkSecondary,
    },
    formFieldLabel: {
      color: PALETTE.gsInkSecondary,
      fontWeight: 600,
    },
    formFieldInput: {
      borderRadius: "10px",
      border: `1px solid ${PALETTE.gsLine}`,
      color: PALETTE.gsInk,
    },
    formFieldInput__focused: {
      borderColor: PALETTE.gsPrimary,
      boxShadow: "0 0 0 2px rgb(61 90 254 / 22%)",
    },
    formButtonPrimary: {
      backgroundColor: PALETTE.gsPrimary,
      borderRadius: "14px",
      fontFamily: "Inter, sans-serif",
      fontWeight: 600,
    },
    formButtonPrimary__hover: {
      backgroundColor: PALETTE.gsPrimary,
    },
    formButtonPrimary__active: {
      backgroundColor: PALETTE.gsPrimaryInk,
    },
    footerActionLink: {
      color: PALETTE.gsPrimaryInk,
      fontWeight: 600,
    },
    footerActionText: {
      color: PALETTE.gsInkSecondary,
    },
    dividerLine: {
      backgroundColor: PALETTE.gsLine,
    },
    socialButtonsBlockButton: {
      borderRadius: "10px",
      border: `1px solid ${PALETTE.gsLine}`,
      color: PALETTE.gsInk,
    },
    alertText: {
      color: PALETTE.gsConflictInk,
    },
  },
};
