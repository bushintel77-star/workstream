import type { Metadata } from "next";
import Link from "next/link";
import { PlanHeroVisual } from "../components/landing/PlanHeroVisual";
import css from "./landing.module.css";

export const metadata: Metadata = {
  title: "Workstream — Curtis & Co",
  description:
    "Landscape design studio for Curtis & Co. Survey, sketch, CAD, and quote on one board.",
  robots: { index: true, follow: true },
};

/**
 * Public landing — brand-first, one composition. Operator register lives at /home.
 */
export default function LandingPage() {
  return (
    <main className={css.page} data-testid="workstream-landing">
      <div className={css.stage}>
        <PlanHeroVisual />
      </div>

      <div className={css.copy}>
        <p className={css.brand}>Workstream</p>
        <h1 className={css.headline}>Garden design that starts on the site.</h1>
        <p className={css.lede}>
          Survey, sketch, CAD, and quote — one board for Curtis &amp; Co.
        </p>
        <div className={css.cta}>
          <Link href="/home" className={css.primary} data-testid="landing-enter-studio">
            Enter studio
          </Link>
          <Link href="/home#new-project" className={css.secondary}>
            New address
          </Link>
        </div>
      </div>

      <footer className={css.foot}>
        <span>Curtis &amp; Co · Melbourne</span>
        <Link href="/legal/privacy">Privacy</Link>
      </footer>
    </main>
  );
}
