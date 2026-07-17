import Link from "next/link";
import { listProjects, type ProjectStatus } from "../lib/api";
import { requireSignedIn } from "../lib/auth";
import { NewProjectAddressForm } from "../components/NewProjectAddressForm";
import home from "./home.module.css";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: "Draft",
  recording: "Recording",
  processing: "Processing",
  survey_review: "Survey",
  design_review: "Design",
  cost_review: "Costing",
  audit: "Audit",
  outputs: "Outputs",
  complete: "Complete",
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
      <header className={home.hero}>
        <p className={home.kicker}>Workstream</p>
        <h1 className={home.brand}>Curtis &amp; Co</h1>
        <p className={home.lede}>
          Canvas-first AI CAD → quantity survey → itemised build → polished quote.
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
          <p className={home.empty}>Add an address to open the design canvas.</p>
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
