import type { Metadata, Viewport } from "next";
import {
  Architects_Daughter,
  Archivo,
  Fraunces,
  IBM_Plex_Mono,
  Inter,
  Space_Grotesk,
} from "next/font/google";
import "../styles/globals.css";
import { ToastHost } from "../components/ToastHost";
import { clerkEnabled } from "../lib/auth";
import { ClerkProvider } from "@clerk/nextjs";

/**
 * Gold Standard 2026 typography (docs/GOLD-STANDARD-2026-TOKENS.md §2).
 *
 * - Inter: UI labels, buttons, inputs, chrome text (--font-body + --font-ui)
 * - Space Grotesk: technical, numeric, coordinate data (--font-tech + --font-mono)
 * - Fraunces: client-deck composition — masthead brand, address hero,
 *   client page headings (--font-editorial)
 * - Architects Daughter: hand-lettered plan annotations (--font-hand)
 * - Sora: legacy UI font variable (--font-inter, kept for compat with main's surfaces)
 */
const fontBody = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});
const fontUi = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ui",
  display: "swap",
});
const fontTech = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-tech",
  display: "swap",
});
const fontMono = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});
const fontEditorial = Fraunces({
  subsets: ["latin"],
  weight: ["400", "700"],
  // Fraunces owns --font-editorial outright (client-deck composition voice).
  // The old double-definition loaded it into --font-display/--font-serif,
  // which globals.css then re-pointed at Space Grotesk/Inter — so Fraunces
  // could never actually render (design-spec debt D5).
  variable: "--font-editorial",
  display: "swap",
});
const fontHand = Architects_Daughter({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-hand",
  display: "swap",
});
const fontInter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});
/**
 * Landscape Canvas v2 chrome typography (handoff §4).
 * - Archivo: UI labels, panel headers, body text (--font-lc-ui)
 * - IBM Plex Mono: numeric, labels, codes, tool tiles (--font-lc-mono)
 *   9.5px floor for outdoor legibility.
 */
const fontLcUi = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-lc-ui",
  display: "swap",
});
const fontLcMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-lc-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Workstream",
  description:
    "Voice-first landscape design and build co-pilot. Melbourne.",
  metadataBase: new URL(
    process.env.PORTAL_BASE_URL ?? "http://localhost:3002",
  ),
  applicationName: "Workstream",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Workstream",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-touch-icon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "Workstream",
    description:
      "Voice-first landscape design and build co-pilot. Melbourne.",
    type: "website",
    locale: "en_AU",
  },
  robots: { index: false, follow: false },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const shell = <>{children}</>;

  return (
    <html lang="en-AU">
      <body
        className={`${fontBody.variable} ${fontEditorial.variable} ${fontMono.variable} ${fontHand.variable} ${fontUi.variable} ${fontInter.variable} ${fontTech.variable} ${fontLcUi.variable} ${fontLcMono.variable}`}
        data-build={
          process.env.NEXT_PUBLIC_BUILD_SHA ??
          process.env.RAILWAY_GIT_COMMIT_SHA ??
          process.env.VERCEL_GIT_COMMIT_SHA ??
          "dev"
        }
      >
        {clerkEnabled ? (
          <ClerkProvider>
            <ToastHost>{shell}</ToastHost>
          </ClerkProvider>
        ) : (
          <ToastHost>{shell}</ToastHost>
        )}
      </body>
    </html>
  );
}
