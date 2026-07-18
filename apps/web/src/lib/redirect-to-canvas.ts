import { redirect } from "next/navigation";
import type { CanvasMode } from "./canvas-mode";

/** Legacy pipeline pages ? one canvas with mode. */
export function redirectToCanvas(projectId: string, mode: CanvasMode) {
  redirect(`/projects/${projectId}?mode=${mode}`);
}
