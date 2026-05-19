import type { Metadata, Viewport } from "next";
import "../styles/globals.css";
import { ToastHost } from "../components/ToastHost";
import { clerkEnabled } from "../lib/auth";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Workstream — Curtis & Co",
  description:
    "Voice-first landscape design and build co-pilot. Curtis & Co, Melbourne.",
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
    apple: [{ url: "/apple-touch-icon.svg" }],
  },
  openGraph: {
    title: "Workstream — Curtis & Co",
    description:
      "Voice-first landscape design and build co-pilot. Curtis & Co, Melbourne.",
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#18181B" },
    { media: "(prefers-color-scheme: dark)", color: "#18181B" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-AU">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Display:wght@600;700&family=JetBrains+Mono:wght@500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {clerkEnabled ? (
          <ClerkProvider>
            <ToastHost>{children}</ToastHost>
          </ClerkProvider>
        ) : (
          <ToastHost>{children}</ToastHost>
        )}
      </body>
    </html>
  );
}
