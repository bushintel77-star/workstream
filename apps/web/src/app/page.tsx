import styles from "./landing.module.css";

export default function LandingPage() {
  return (
    <main className={styles.page}>
      <header className={styles.masthead}>
        <div className={styles.brand}>
          Curtis &amp; Co
          <span className={styles.brandSub}>
            Boutique Landscape Design · Melbourne
          </span>
        </div>
        <span className={styles.kicker}>POWERED BY CONSTRUCT</span>
      </header>

      <section className={styles.hero}>
        <span className={styles.eyebrow}>VOICE-FIRST DESIGN STUDIO</span>
        <h1 className={styles.headline}>
          One walkthrough.
          <br />
          The whole job.
        </h1>
        <p className={styles.lede}>
          Tim Curtis walks the site, talks. By the time he's at the car
          the survey, design, costing, audit and quote are ready —
          Stonnington stormwater pack drafted, MYOB invoice queued,
          Mick on his way with the trencher.
        </p>
      </section>

      <section className={styles.grid}>
        <Feature
          kicker="SURVEY"
          title="Lot, house, garden in seconds"
          body="Address in, Vicmap cadastre out. Building footprint subtracted automatically. Edge measurements rendered along every boundary."
        />
        <Feature
          kicker="DESIGN"
          title="Curtis house style, every time"
          body="Claude Opus drafts the proposal in Curtis & Co's vocabulary: pleached hornbeam screens, mass-planted Lomandra, bluestone paving. Off-style species rejected at the gate."
        />
        <Feature
          kicker="COSTING"
          title="Lean · Standard · Buffer"
          body="Every line matched to the live rate card. Pleach stock upgrades on Buffer. POA items surfaced separately, never silent in totals."
        />
        <Feature
          kicker="AUDIT"
          title="Fidelity, safety, scope"
          body="A second Claude pass interrogates its own work. Blocking findings stop output generation. Overrides recorded forever in the project ledger."
        />
        <Feature
          kicker="OUTPUTS"
          title="Quote, schedule, scope, task list"
          body="Branded, printable, ready to hand the client. Permit packs pre-filled from the survey for Stonnington and Yarra heritage."
        />
        <Feature
          kicker="GRID & SOIL"
          title="Live build-phase dictation"
          body="On site, mid-build. The operator dictates — tasks land in the crew app, the material ledger updates, the invoice draft adjusts. No clipboard."
        />
      </section>

      <footer className={styles.colophon}>
        <span>Curtis &amp; Co · Melbourne</span>
        <span>Prepared with Construct</span>
      </footer>
    </main>
  );
}

function Feature({
  kicker,
  title,
  body,
}: {
  kicker: string;
  title: string;
  body: string;
}) {
  return (
    <article className={styles.feature}>
      <span className={styles.featureKicker}>{kicker}</span>
      <h2 className={styles.featureTitle}>{title}</h2>
      <p className={styles.featureBody}>{body}</p>
    </article>
  );
}
