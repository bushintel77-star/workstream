import Link from "next/link";
import { listProjects, type ProjectStatus } from "../lib/api";
import { requireSignedIn } from "../lib/auth";
import { NewProjectAddressForm } from "../components/NewProjectAddressForm";
import { WorkflowPreviewStrip } from "../components/WorkflowPreviewStrip";
import home from "./home.module.css";

export const dynamic = "force-dynamic";

/** Canvas-stage labels — not the old pipeline hub names. */
const STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: "Survey",
  recording: "Survey",
  processing: "Survey",
  survey_review: "Sketch",
  design_review: "CAD",
  cost_review: "Quote",
  audit: "Quote",
  outputs: "Share",
  complete: "Share",
};

export default async function HomePage() {
  await requireSignedIn();
  let projects: Awaited<ReturnType<typeof listProjects>> = [];
  let loadError: string | null = null;
  try {
    projects = await listProjects();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Could not reach the API.";
  }

  return (
    <main className={home.page}>
      <WorkflowPreviewStrip />
      <header className={home.hero}>
        <p className={home.kicker}>Workstream</p>
        <h1 className={home.brand}>Curtis &amp; Co</h1>
        <p className={home.lede}>
          Type an address. Get a concept, working drawing, and live estimate —
          then share the quote.
        </p>
        <div className={home.composer}>
          <NewProjectAddressForm />
        </div>
      </header>

      {loadError ? (
        <p className={home.error} role="alert">
          {loadError}
        </p>
      ) : null}

      <section className={home.list} aria-labelledby="sites-heading">
        <h2 id="sites-heading" className={home.listTitle}>
          Sites
        </h2>
        {projects.length === 0 ? (
          <p className={home.empty}>
            Start with an address — about two minutes to a shareable quote.
          </p>
        ) : (
          <ul className={home.ul}>
            {projects.map((p) => (
              <li key={p.id}>
                <Link className={home.row} href={`/projects/${p.id}`}>
                  <span className={home.addr}>{p.address}</span>
                  <span className={home.meta}>
                    {STATUS_LABEL[p.status] ?? p.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
