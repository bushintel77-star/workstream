import { redirectToCanvas } from "../../../../lib/redirect-to-canvas";

export default async function AuditRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirectToCanvas(id, "share");
}
