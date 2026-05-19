"use server";

import { revalidatePath } from "next/cache";
import {
  createCrewApi,
  createOverrideApi,
  createProjectApi,
  createTaskApi,
  deleteCrewApi,
  deleteIntegrationApi,
  deleteProjectApi,
  runAudit,
  runCosting,
  runDesign,
  createPortalMagicLink,
  runOutput,
  runSurvey,
  setIntegrationApi,
  updateRateCardItemApi,
  updateTaskStatusApi,
  type CrewRole,
  type OutputKind,
  type TaskPriority,
  type TaskStatus,
} from "../lib/api";

/* -- Projects --------------------------------------------------------- */

export async function createProjectAction(formData: FormData) {
  const address = String(formData.get("address") ?? "").trim();
  if (address.length < 5) return;
  await createProjectApi({ address });
  revalidatePath("/");
}

export async function deleteProjectAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  await deleteProjectApi(id);
  revalidatePath("/");
}

/* -- Pipeline runners ------------------------------------------------- */

export async function runSurveyAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return;
  await runSurvey(projectId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/survey`);
}

export async function runDesignAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return;
  await runDesign(projectId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/design`);
}

export async function runCostingAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return;
  await runCosting(projectId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/costing`);
}

export async function runAuditAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return;
  await runAudit(projectId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/audit`);
}

export async function runOutputAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const kind = String(formData.get("kind") ?? "") as OutputKind;
  if (!projectId || !kind) return;
  await runOutput(projectId, kind);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/outputs`);
}

export type PortalLinkState = {
  url?: string;
  error?: string;
};

export async function createQuotePortalLinkAction(
  _prev: PortalLinkState | null,
  formData: FormData,
): Promise<PortalLinkState> {
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return { error: "Missing project." };
  try {
    const res = await createPortalMagicLink(projectId, "quote_view");
    return { url: res.portal_url };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not create client link.";
    return { error: message };
  }
}

export async function createOverrideAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const findingIndexRaw = String(formData.get("finding_index") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const finding_index = Number(findingIndexRaw);
  if (
    !projectId ||
    !Number.isInteger(finding_index) ||
    finding_index < 0 ||
    reason.length < 8
  ) {
    return;
  }
  await createOverrideApi(projectId, { finding_index, reason });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/audit`);
}

/* -- Tasks ------------------------------------------------------------ */

export async function createTaskAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const assignee = String(formData.get("assignee_name") ?? "").trim();
  const priority = String(formData.get("priority") ?? "medium") as TaskPriority;
  if (!projectId || !title) return;
  await createTaskApi(projectId, {
    title,
    assignee_name: assignee || null,
    priority,
  });
  revalidatePath(`/projects/${projectId}/tasks`);
}

export async function updateTaskStatusAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  const status = String(formData.get("status") ?? "") as TaskStatus;
  if (!projectId || !taskId || !status) return;
  await updateTaskStatusApi(taskId, status);
  revalidatePath(`/projects/${projectId}/tasks`);
}

/* -- Crew ------------------------------------------------------------- */

export async function createCrewAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "tradesperson") as CrewRole;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const rateRaw = String(formData.get("hourly_rate") ?? "0");
  const hourly_rate = Number.isFinite(Number(rateRaw)) ? Number(rateRaw) : 0;
  if (!name) return;
  await createCrewApi({ name, role, phone, email, hourly_rate });
  revalidatePath("/settings/crew");
}

export async function deleteCrewAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deleteCrewApi(id);
  revalidatePath("/settings/crew");
}

/* -- Rate card -------------------------------------------------------- */

export async function updateRateAction(formData: FormData) {
  const sku = String(formData.get("sku") ?? "");
  const rateRaw = String(formData.get("rate") ?? "");
  const rate = Number(rateRaw);
  if (!sku || !Number.isFinite(rate) || rate < 0) return;
  await updateRateCardItemApi(sku, { rate });
  revalidatePath("/settings/rate-card");
}

/* -- Integrations ----------------------------------------------------- */

export async function setIntegrationAction(formData: FormData) {
  const key = String(formData.get("key") ?? "").trim();
  const value = String(formData.get("value") ?? "").trim();
  if (!key || !value) return;
  await setIntegrationApi(key, value);
  revalidatePath("/settings");
}

export async function clearIntegrationAction(formData: FormData) {
  const key = String(formData.get("key") ?? "").trim();
  if (!key) return;
  await deleteIntegrationApi(key);
  revalidatePath("/settings");
}
