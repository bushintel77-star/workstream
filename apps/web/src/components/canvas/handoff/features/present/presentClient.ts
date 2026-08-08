import type {
  CreatePresentationDocumentInput,
  PresentationDissectResponse,
  PresentationDocument,
  PresentationFormatRequest,
  PresentationFormatResponse,
  UpdatePresentationDocumentInput,
} from "@workstream/contracts";

/**
 * Browser → Next route → API. Stable URL (no Server Action hash), so a
 * Railway redeploy does not break an open Present tab's autosave.
 */

export async function listPresentationDocumentsClient(
  projectId: string,
): Promise<PresentationDocument[]> {
  const res = await fetch(
    `/api/projects/${projectId}/presentation-documents`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `List failed (${res.status})`);
  }
  const data = (await res.json()) as { documents: PresentationDocument[] };
  return data.documents;
}

export async function createPresentationDocumentClient(
  projectId: string,
  body: CreatePresentationDocumentInput,
): Promise<PresentationDocument> {
  const res = await fetch(
    `/api/projects/${projectId}/presentation-documents`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Create failed (${res.status})`);
  }
  const data = (await res.json()) as { document: PresentationDocument };
  return data.document;
}

export async function updatePresentationDocumentClient(
  projectId: string,
  docId: string,
  body: UpdatePresentationDocumentInput,
): Promise<PresentationDocument> {
  const res = await fetch(
    `/api/projects/${projectId}/presentation-documents/${docId}`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Save failed (${res.status})`);
  }
  const data = (await res.json()) as { document: PresentationDocument };
  return data.document;
}

export async function deletePresentationDocumentClient(
  projectId: string,
  docId: string,
): Promise<void> {
  const res = await fetch(
    `/api/projects/${projectId}/presentation-documents/${docId}`,
    {
      method: "DELETE",
      cache: "no-store",
    },
  );
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Delete failed (${res.status})`);
  }
}

/**
 * Dissect the finished plan into proposed plan-crop ghosts. Ghosts are
 * ephemeral review state; the caller converts accepted ghosts into
 * PlanCropPanel entries on the current page.
 */
export async function dissectPlanClient(
  projectId: string,
): Promise<PresentationDissectResponse> {
  const res = await fetch(
    `/api/projects/${projectId}/presentation-dissect`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
      cache: "no-store",
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Dissect failed (${res.status})`);
  }
  return (await res.json()) as PresentationDissectResponse;
}

/**
 * Propose an editorial layout for a page's panels. Ghosts are ephemeral review
 * state; the caller applies accepted ghosts as panel rect updates via the
 * document PUT.
 */
export async function formatPageClient(
  projectId: string,
  body: PresentationFormatRequest,
): Promise<PresentationFormatResponse> {
  const res = await fetch(
    `/api/projects/${projectId}/presentation-format`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Format failed (${res.status})`);
  }
  return (await res.json()) as PresentationFormatResponse;
}
