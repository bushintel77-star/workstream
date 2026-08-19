import type { Metadata } from "next";
import { buildHeroAerialUrl, heroPinLabel } from "../lib/landingGeo";
import { LandingCanvas } from "../components/landing/LandingCanvas";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Workstream — onsite sketch to fit sheet",
  description:
    "One title boundary, pulled from the live Victorian cadastre. Sketch onsite, trace the frontage, generate the fit sheet.",
};

/**
 * Canvas-first landing — the hero IS the product: a real sub-metre aerial of
 * a Stonnington block, graded to dusk, with a real Vicmap title boundary
 * drawn over it in the studio's own title cobalt. No mock telemetry, no
 * screenshots, no blank states: the low-res export paints instantly and the
 * full frame fades over it; the boundary draws itself in when the live
 * registry feed lands.
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
        pinLabel={heroPinLabel()}
      />
    </>
  );
}
