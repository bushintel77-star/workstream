import { getProject, listOutputs } from "../../../lib/api";
import { ProjectShareFab } from "../../../components/ProjectShareFab";
import layout from "./project-layout.module.css";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, outputs] = await Promise.all([
    getProject(id),
    listOutputs(id).catch(() => []),
  ]);

  if (!project) {
    return <>{children}</>;
  }

  const quoteOutput = outputs.find((o) => o.kind === "quote");

  return (
    <>
      <div className={layout.content}>{children}</div>
      <ProjectShareFab
        projectId={id}
        address={project.address}
        quoteUrl={quoteOutput?.uri ?? null}
        hasQuote={Boolean(quoteOutput)}
        clientName={project.client_name}
        clientEmail={project.client_email}
      />
    </>
  );
}
