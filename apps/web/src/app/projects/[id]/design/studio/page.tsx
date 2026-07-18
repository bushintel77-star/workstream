import { redirectToCanvas } from "../../../../../lib/redirect-to-canvas";

export default async function DesignStudioRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirectToCanvas(id, "sketch");
}
