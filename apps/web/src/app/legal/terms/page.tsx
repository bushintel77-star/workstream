import Link from "next/link";
import s from "../../../styles/app.module.css";

export const metadata = { title: "Terms · Curtis & Co" };

const ABN = process.env.NEXT_PUBLIC_ABN ?? "—";
const TRADING_NAME =
  process.env.NEXT_PUBLIC_TRADING_NAME ?? "Curtis & Co Pty Ltd";
const LAST_UPDATED = "19 May 2026";

export default function TermsPage() {
  return (
    <main className={s.pageNarrow}>
      <header className={s.masthead}>
        <div className={s.brand}>
          Terms
          <span className={s.brandSub}>Curtis &amp; Co · Workstream</span>
        </div>
        <Link href="/" className={s.crumb}>← Home</Link>
      </header>

      <h1 className={s.headline}>Terms of service</h1>
      <p className={s.lede}>Last updated {LAST_UPDATED}.</p>

      <h2 className={s.sectionHeading}>Quote validity</h2>
      <p>
        Quotes issued via Workstream are valid for 30 days from the date of
        issue. Prices reflect our rate card and supplier pricing at the time of
        quoting. Price changes after acceptance for genuinely provisional (POA)
        items will be communicated and signed off before the work proceeds.
      </p>

      <h2 className={s.sectionHeading}>Deposit &amp; staged billing</h2>
      <p>
        A 20% deposit (or such amount specified on your quote) is required to
        secure your project. The balance is billed in stages as agreed work
        completes. All amounts are in Australian dollars and include GST where
        applicable.
      </p>

      <h2 className={s.sectionHeading}>Scope</h2>
      <p>
        The scope of works delivered with your quote is the binding scope.
        Variations are recorded as written change orders and billed separately
        at our standard rates. Latent site conditions (rock, contaminated soil,
        unexpected services) that materially affect the works are billed at
        cost plus 15%.
      </p>

      <h2 className={s.sectionHeading}>Plants &amp; warranty</h2>
      <p>
        Plant stock is supplied healthy at installation. We warrant
        establishment for 90 days subject to the client following the supplied
        watering and care plan. Plants failing due to neglect, vandalism, or
        weather events outside our control are not covered.
      </p>

      <h2 className={s.sectionHeading}>Permits &amp; compliance</h2>
      <p>
        Permits required for the works (heritage overlays, stormwater, tree
        protection) are the client&apos;s responsibility unless we have
        explicitly contracted to manage them. We provide pre-filled
        documentation as a courtesy.
      </p>

      <h2 className={s.sectionHeading}>Liability</h2>
      <p>
        {TRADING_NAME} maintains professional indemnity and public liability
        insurance to commercially appropriate limits. To the maximum extent
        permitted by Australian Consumer Law, our liability for any claim is
        limited to the value of the quoted works.
      </p>

      <h2 className={s.sectionHeading}>Cancellation</h2>
      <p>
        Cancellations made before site mobilisation are refunded less a 5%
        administration fee. Cancellations after mobilisation are charged for
        works performed to date plus restocking on any non-returnable
        materials.
      </p>

      <footer className={s.colophon}>
        <span>{TRADING_NAME} · ABN {ABN}</span>
        <Link href="/legal/privacy">Privacy →</Link>
      </footer>
    </main>
  );
}
