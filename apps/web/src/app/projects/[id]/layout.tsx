import { notFound } from "next/navigation";
import { requireSignedIn } from "../../../lib/auth";
import { getIntegrationSummary, getProject, listOutputs } from "../../../lib/api";
import { AppNav } from "../../../components/AppNav";
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
  await requireSignedIn();
  const { id } = await params;
  const [project, outputs, summary] = await Promise.all([
    getProject(id),
    listOutputs(id).catch(() => []),
    getIntegrationSummary().catch(() => null),
  ]);

  if (!project) {
    notFound();
  }

  const quoteOutput = outputs.find((o) => o.kind === "quote");

  return (
    <>
      <AppNav summary={summary} />
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
