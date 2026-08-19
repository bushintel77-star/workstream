import type { Metadata } from "next";
import { buildHeroAerialUrl } from "../lib/landingGeo";
import { LandingCanvas } from "../components/landing/LandingCanvas";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Workstream — enter your address",
  description:
    "The garden, drawn before it is built. Enter your address — the live title boundary, sketch, CAD and fit sheet follow from it.",
};

/**
 * Canvas-first landing — the hero says nothing: a real sub-metre aerial of
 * a Stonnington block, graded to dusk, with a real Vicmap title boundary
 * drawn over it, and one address entry floating on the frame. Type an
 * address, pick the GNAF match, and the hero re-centres on that property
 * and draws its live boundary. The product demonstrates itself.
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
