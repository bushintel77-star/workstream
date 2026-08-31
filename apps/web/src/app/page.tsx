import { redirect } from "next/navigation";
import { listProjects } from "../lib/api";
import { requireSignedIn } from "../lib/auth";
import { NewProjectAddressForm } from "../components/NewProjectAddressForm";
import home from "./home.module.css";

export const dynamic = "force-dynamic";

/** Canvas-first root. Signed-in operators never see a marketing landing or a
 * dashboard register — they land straight in the most recent project canvas.
 * Unsigned visitors get the address composer (the only surface that creates
 * a project and thus a canvas to land on). */
export default async function RootPage() {
  await requireSignedIn();

  let rawProjects: Awaited<ReturnType<typeof listProjects>> = [];
  try {
    rawProjects = await listProjects();
  } catch {
    /* fail open — let the address composer create the first project */
  }

  const mostRecent = rawProjects
    .slice()
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )[0];

  if (mostRecent) {
    redirect(`/projects/${mostRecent.id}`);
  }

  return (
    <main className={home.page}>
      <div className={home.layout}>
        <aside className={home.aside}>
          <header className={home.masthead}>
            <p className={home.mastheadMark}>Workstream · Melbourne</p>
            <h1 className={home.mastheadTitle}>Workstream</h1>
          </header>

          <section className={home.composer} id="new-project">
            <label className={home.composerLabel} htmlFor="project-address">
              New address
            </label>
            <NewProjectAddressForm />
          </section>
        </aside>

        <section className={home.index}>
          <div className={home.emptyState}>
            <h3>No projects yet</h3>
            <p>Start your first project with a Melbourne site address.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
