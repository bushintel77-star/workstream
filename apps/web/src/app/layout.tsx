import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Construct — Curtis & Co",
  description:
    "Voice-first landscape design and build co-pilot. Curtis & Co, Melbourne.",
  metadataBase: new URL(
    process.env.PORTAL_BASE_URL ?? "http://localhost:3002",
  ),
  openGraph: {
    title: "Construct — Curtis & Co",
    description:
      "Voice-first landscape design and build co-pilot. Curtis & Co, Melbourne.",
    type: "website",
    locale: "en_AU",
  },
  robots: { index: false, follow: false },
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
      <body>{children}</body>
    </html>
  );
}
