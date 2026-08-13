import type { Metadata, Viewport } from "next";
import {
  Architects_Daughter,
  Fraunces,
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
 * - Inter: UI labels, buttons, inputs, chrome text (--font-ui + --font-body)
 * - Space Grotesk: technical, numeric, coordinate data (--font-tech + --font-mono)
 * - Fraunces: display / presentation deck composition (--font-display + --font-serif)
 * - Architects Daughter: hand-lettered plan annotations (--font-hand)
 *
 * Retired: Sora, IBM Plex Sans/Mono/Serif.
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
const fontDisplay = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});
const fontSerif = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-serif",
  display: "swap",
});
const fontHand = Architects_Daughter({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-hand",
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
        className={`${fontBody.variable} ${fontUi.variable} ${fontTech.variable} ${fontMono.variable} ${fontDisplay.variable} ${fontSerif.variable} ${fontHand.variable}`}
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
