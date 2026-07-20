import Link from "next/link";
import { getIntegrationSummary, listProjects } from "../lib/api";
import { requireSignedIn } from "../lib/auth";
import { AppNav } from "../components/AppNav";
import { DashboardProjectList } from "../components/DashboardProjectList";
import { NewProjectAddressForm } from "../components/NewProjectAddressForm";
import { WorkflowPreviewStrip } from "../components/WorkflowPreviewStrip";
import home from "./home.module.css";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await requireSignedIn();
  let projects: Awaited<ReturnType<typeof listProjects>> = [];
  const summary = await getIntegrationSummary().catch(() => null);
  let loadError: string | null = null;
  try {
    projects = await listProjects();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Could not reach the API.";
  }

  return (
    <main className={home.page}>
      <AppNav summary={summary} />
      <WorkflowPreviewStrip />
      <header className={home.hero}>
        <p className={home.kicker}>Workstream</p>
        <h1 className={home.brand}>Curtis &amp; Co</h1>
        <p className={home.lede}>
          Type an address. Get a concept, working drawing, and live estimate —
          then share the quote.
        </p>
        <div className={home.composer} id="new-project">
          <NewProjectAddressForm />
        </div>
      </header>

      {loadError ? (
        <p className={home.error} role="alert">
          {loadError}
          <Link className={home.retryLink} href="/">
            Retry
          </Link>
        </p>
      ) : null}

      <section className={home.list} aria-labelledby="sites-heading">
        <h2 id="sites-heading" className={home.listTitle}>
          Sites
        </h2>
        <DashboardProjectList projects={projects} />
      </section>
    </main>
  );
}
