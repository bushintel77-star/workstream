import { fetchPortalQuote } from "../../../../lib/portal-api";
import { QuotePortal } from "../../../../components/QuotePortal";
import styles from "./quote.module.css";

export const runtime = "edge";

export default async function QuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await fetchPortalQuote(token);

  if ("error" in data) {
    return (
      <main className={styles.errorPage}>
        <span className={styles.kicker}>LINK EXPIRED OR INVALID</span>
        <h1 className={styles.errorHeading}>This link has expired. Contact your landscaper.</h1>
        <p className={styles.errorBody}>
          Curtis &amp; Co can issue a fresh secure quote link from the project.
        </p>
      </main>
    );
  }

  return <QuotePortal data={data} />;
}
