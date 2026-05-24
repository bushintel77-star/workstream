import { fetchPortalQuote } from "../../../../lib/api";
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
        <h1 className={styles.errorHeading}>This quote link can&apos;t be opened.</h1>
        <p className={styles.errorBody}>
          The studio can issue a fresh link from the project. Links expire after
          7 days for your security.
        </p>
      </main>
    );
  }

  return <QuotePortal data={data} token={token} />;
}
