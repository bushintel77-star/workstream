import type { Metadata, Viewport } from "next";
import {
  Architects_Daughter,
  Fraunces,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  IBM_Plex_Serif,
  Inter,
  JetBrains_Mono,
  Space_Grotesk,
  Sora,
} from "next/font/google";
import "../styles/globals.css";
import { ToastHost } from "../components/ToastHost";
import { clerkEnabled } from "../lib/auth";
import { ClerkProvider } from "@clerk/nextjs";

const fontBody = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});
const fontDisplay = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});
const fontMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});
const fontSerif = IBM_Plex_Serif({
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
const fontUi = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ui",
  display: "swap",
});
const fontInter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});
const fontTech = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-tech",
  display: "swap",
});
const fontTechnicalMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-technical-mono",
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
        className={`${fontBody.variable} ${fontDisplay.variable} ${fontMono.variable} ${fontSerif.variable} ${fontHand.variable} ${fontUi.variable} ${fontInter.variable} ${fontTech.variable} ${fontTechnicalMono.variable}`}
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
