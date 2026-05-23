import { requireProject } from "../../../../lib/project-guard";
import {
  getProjectGallery,
  getSiteContext,
  getSurvey,
  listProjectFiles,
} from "../../../../lib/api";
import s from "../../../../styles/app.module.css";
import { FilingUploadForm } from "../../../../components/FilingUploadForm";
import { SwipeGallery } from "../../../../components/SwipeGallery";
import { NotFoundPage, ProjectMasthead } from "../ProjectShell";

export const dynamic = "force-dynamic";

export default async function FilingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await requireProject(id);
  if (!project) return <NotFoundPage message="Project not found." />;

  const [gallery, files, survey, siteContext] = await Promise.all([
    getProjectGallery(id).catch(() => ({ items: [], viewable: [] })),
    listProjectFiles(id).catch(() => []),
    getSurvey(id).catch(() => null),
    getSiteContext(id).catch(() => null),
  ]);

  return (
    <main className={s.page}>
      <ProjectMasthead project={project} active="filing" />

      <h1 className={s.headline}>Filing</h1>
      <p className={s.brandSub}>
        Title slide shows the backyard already mapped from survey. Swipe for your
        uploaded plans and photos.
      </p>

      <SwipeGallery
        items={gallery.viewable}
        address={project.address}
        survey={survey}
        siteContext={siteContext}
        titleKicker="Project filing"
      />

      <div className={s.grid2} style={{ marginTop: "var(--s-5)" }}>
        <FilingUploadForm projectId={id} />
        <section className={s.card}>
          <h2 className={s.cardTitle}>On file ({files.length})</h2>
          {files.length === 0 ? (
            <p className={s.brandSub}>No uploads yet.</p>
          ) : (
            <ul>
              {files.map((f) => (
                <li key={f.id}>
                  <a href={f.uri} target="_blank" rel="noopener noreferrer">
                    {f.title}
                  </a>
                  <span className={s.brandSub}> · {f.kind}</span>
                </li>
              ))}
            </ul>
          )}
          <p className={s.brandSub} style={{ marginTop: "var(--s-3)" }}>
            Photo measurements from site visits appear in the gallery after capture.
          </p>
        </section>
      </div>
    </main>
  );
}
