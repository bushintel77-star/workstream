import { fetchPublicShare } from "../../../lib/share-api";
import { ClientShareDecision } from "../../../components/share/ClientShareDecision";
import css from "./sharePage.module.css";

export default async function ShareTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await fetchPublicShare(token);

  if ("error" in data) {
    return (
      <main className={css.errorPage} data-testid="share-not-found">
        <span className={css.kicker}>Link unavailable</span>
        <h1 className={css.errorHeading}>This share link is not available</h1>
        <p className={css.errorBody}>
          It may have been replaced by a newer revision. Contact Curtis &amp; Co
          for an updated link.
        </p>
      </main>
    );
  }

  return (
    <main className={css.page}>
      <div className={css.shell}>
        <ClientShareDecision token={token} initial={data} />
      </div>
    </main>
  );
}
