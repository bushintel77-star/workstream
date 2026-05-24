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
import { loadOptional } from "../../../../lib/load-optional";

export const dynamic = "force-dynamic";

export default async function FilingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await requireProject(id);
  if (!project) return <NotFoundPage message="Project not found." />;

  const [galleryResult, filesResult, surveyResult, siteResult] =
    await Promise.all([
      loadOptional("Gallery", () => getProjectGallery(id)),
      loadOptional("Files", () => listProjectFiles(id)),
      loadOptional("Survey", () => getSurvey(id)),
      loadOptional("Site context", () => getSiteContext(id)),
    ]);

  const gallery = galleryResult.data ?? { items: [], viewable: [] };
  const files = filesResult.data ?? [];
  const survey = surveyResult.data;
  const siteContext = siteResult.data;
  const filingLoadFailed =
    galleryResult.failed || filesResult.failed;

  return (
    <main className={s.page}>
      <ProjectMasthead project={project} active="filing" />

      <h1 className={s.headline}>Filing</h1>
      <p className={s.brandSub}>
        Title slide shows the backyard already mapped from survey. Swipe for your
        uploaded plans and photos.
      </p>

      {filingLoadFailed && (
        <div className={s.error} role="status">
          Could not load all filing data. Try refreshing — uploads may still
          work.
        </div>
      )}

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
