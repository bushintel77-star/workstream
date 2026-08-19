import Link from "next/link";
import s from "../../../styles/app.module.css";

export const metadata = { title: "Privacy · Workstream" };

const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_PRIVACY_EMAIL ?? "privacy@curtisandco.com.au";
const ABN = process.env.NEXT_PUBLIC_ABN ?? "—";
const TRADING_NAME =
  process.env.NEXT_PUBLIC_TRADING_NAME ?? "Workstream Pty Ltd";
const LAST_UPDATED = "19 May 2026";

export default function PrivacyPage() {
  return (
    <main className={s.pageNarrow}>
      <header className={s.masthead}>
        <div className={s.brand}>
          Privacy
          <span className={s.brandSub}>Workstream</span>
        </div>
        <Link href="/" className={s.crumb}>← Home</Link>
      </header>

      <h1 className={s.headline}>Privacy policy</h1>
      <p className={s.lede}>Last updated {LAST_UPDATED}.</p>

      <h2 className={s.sectionHeading}>Who we are</h2>
      <p>
        {TRADING_NAME} (ABN {ABN}) operates Workstream — a landscape design and
        build co-pilot used internally by our studio and by clients we issue
        quote links to. This policy explains what personal information we
        collect when you use Workstream, why we collect it, and your rights
        under the Australian Privacy Principles (APPs).
      </p>

      <h2 className={s.sectionHeading}>What we collect</h2>
      <ul>
        <li>
          <strong>Site address &amp; property data</strong> — used to fetch
          cadastral polygons and forecast weather for the build window.
        </li>
        <li>
          <strong>Contact details</strong> — name, email and phone you provide
          on a quote, used to send quote / deposit links and progress updates.
        </li>
        <li>
          <strong>Recordings &amp; transcripts</strong> — site-walk dictation
          captured by the operator app. Transcripts are processed by OpenAI
          Whisper.
        </li>
        <li>
          <strong>Photos</strong> — captured by the operator for measurement
          and progress documentation. Processed by Anthropic Claude Vision for
          measurement extraction.
        </li>
        <li>
          <strong>Payment information</strong> — handled exclusively by Stripe
          when you accept a quote. We never see or store your
          card details.
        </li>
        <li>
          <strong>Operational logs</strong> — request times, error traces,
          IP address for rate limiting and abuse prevention.
        </li>
      </ul>

      <h2 className={s.sectionHeading}>Where it lives</h2>
      <p>
        Workstream runs on Railway. Recordings and
        outputs are stored on attached SSD volumes; backups follow our internal
        retention schedule (90 days for recordings, 7 years for accounting
        artefacts to meet ATO requirements).
      </p>

      <h2 className={s.sectionHeading}>Third parties</h2>
      <p>
        We share specific data with the minimum third parties needed to run the
        pipeline: Anthropic (design + audit + photo measurement), OpenAI
        (transcription), Stripe (payments), MYOB / Xero
        (accounting). Site data (boundaries, addresses, imagery, overlays) is
        sourced from the Victorian Government's open data services. Each
        third party is contracted to process data only for the stated
        purpose.
      </p>

      <h2 className={s.sectionHeading}>Your rights</h2>
      <p>
        Under the APPs you may request access to, correction of, or deletion of
        your personal information. To do so, email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We respond
        within 30 days.
      </p>

      <h2 className={s.sectionHeading}>Complaints</h2>
      <p>
        If you believe we have breached the APPs, contact us first at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. If unresolved,
        you may complain to the Office of the Australian Information
        Commissioner (oaic.gov.au).
      </p>

      <footer className={s.colophon}>
        <span>{TRADING_NAME} · ABN {ABN}</span>
        <Link href="/legal/terms">Terms →</Link>
      </footer>
    </main>
  );
}
