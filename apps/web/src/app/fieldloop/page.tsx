import { Big_Shoulders, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import type { Metadata } from "next";
import { FieldloopPortal } from "../../components/fieldloop/FieldloopPortal";

const display = Big_Shoulders({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--fl-font-display",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--fl-font-body",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--fl-font-mono",
});

export const metadata: Metadata = {
  title: "Fieldloop — customer portal",
};

/** Fieldloop customer portal (Caulfield South Plumbing) — faithful port of
 *  the uploaded mockup. Demo data: the real API wiring is the follow-up. */
export default function FieldloopPage() {
  const fontVars = `${display.variable} ${plexSans.variable} ${plexMono.variable}`;
  return <FieldloopPortal fontVars={fontVars} />;
}
