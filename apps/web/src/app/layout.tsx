import type { Metadata, Viewport } from "next";
import "../styles/globals.css";
import { ToastHost } from "../components/ToastHost";
import { clerkEnabled } from "../lib/auth";
import { ClerkProvider } from "@clerk/nextjs";

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Architects+Daughter&family=IBM+Plex+Mono:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Serif:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
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
