import type { Metadata } from "next";
import { buildHeroAerialUrl } from "../lib/landingGeo";
import { LandingCanvas } from "../components/landing/LandingCanvas";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Workstream — From GIS ingest to client sign-off",
  description:
    "From GIS ingest to client sign-off. Drop an address — Vicmap boundaries, stylus sketching, live takeoffs, and a client portal follow from it. Skip the CAD.",
};

/**
 * Canvas-first landing — a real sub-metre aerial of a Stonnington block,
 * graded to dusk, with a live Vicmap title boundary drawn over it, one
 * address entry, and the studio's pitch: from GIS ingest to client sign-off.
 * Type an address, pick the GNAF match, and the hero re-centres on that
 * property and draws its live boundary. The product demonstrates itself —
 * every claim on the page is a feature the studio ships.
 */
export default function LandingPage() {
  return (
    <>
      <link
        rel="preconnect"
        href="https://services.arcgisonline.com"
        crossOrigin="anonymous"
      />
      <LandingCanvas
        aerialUrl={buildHeroAerialUrl()}
        aerialLowUrl={buildHeroAerialUrl(64, 40)}
      />
    </>
  );
}
