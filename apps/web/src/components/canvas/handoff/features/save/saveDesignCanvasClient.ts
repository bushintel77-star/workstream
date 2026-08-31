import type { DesignCanvas } from "@workstream/contracts";

export type SketchQuoteSummary = {
  total: number;
  budget_low: number;
  budget_mid: number;
  budget_high: number;
  garden_area_m2: number;
  line_count: number;
};

export type SaveDesignCanvasClientResult = {
  canvas: DesignCanvas;
  quote: SketchQuoteSummary | null;
};

/**
 * Browser → Next route → API. Stable URL (no Server Action hash), so a
 * Railway redeploy does not break an open studio tab's autosave.
 */
export async function saveDesignCanvasClient(
  projectId: string,
  body: {
    placements: DesignCanvas["placements"];
    strokes?: DesignCanvas["strokes"];
    irrigation_zones?: DesignCanvas["irrigation_zones"];
    annotations?: DesignCanvas["annotations"];
    image_layers?: DesignCanvas["image_layers"];
    photo_elevations?: DesignCanvas["photo_elevations"];
    site_frame?: DesignCanvas["site_frame"];
    features?: DesignCanvas["features"];
    construction_trenches?: DesignCanvas["construction_trenches"];
    presentation_pack?: DesignCanvas["presentation_pack"];
    lifecycle_phase?: DesignCanvas["lifecycle_phase"];
    /** Spatial Sketching planes — see DesignCanvas.canvases. */
    canvases?: DesignCanvas["canvases"];
    /** Legal setback lines — see DesignCanvas.setback_lines. */
    setback_lines?: DesignCanvas["setback_lines"];
    /** Building footprints — see DesignCanvas.building_footprints. */
    building_footprints?: DesignCanvas["building_footprints"];
    artboard_ids?: DesignCanvas["artboard_ids"];
    branch_id?: string;
  },
): Promise<SaveDesignCanvasClientResult> {
  if (!projectId.trim()) {
    throw new Error("Missing project — cannot save site plan");
  }

  let branchId = body.branch_id;
  if (!branchId && typeof sessionStorage !== "undefined") {
    try {
      branchId =
        sessionStorage.getItem(`ws-design-branch:${projectId}`) ?? undefined;
    } catch {
      /* ignore */
    }
  }

  let res: Response;
  try {
    res = await fetch(`/api/projects/${projectId}/design-canvas`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...body,
        ...(branchId ? { branch_id: branchId } : {}),
      }),
      cache: "no-store",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Couldn't reach the server: ${msg}`, { cause: err });
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail = text;
    try {
      const json = JSON.parse(text) as {
        message?: string;
        error?: string;
      };
      detail = json.message ?? json.error ?? text;
    } catch {
      /* keep raw text */
    }
    if (res.status === 502 || res.status >= 500) {
      throw new Error(`Couldn't reach the server: ${detail || res.status}`);
    }
    throw new Error(detail || `Save failed (${res.status})`);
  }

  return (await res.json()) as SaveDesignCanvasClientResult;
}

/** Classify persist failures for toast / chip copy. */
export function classifySaveError(
  err: unknown,
): "unreachable" | "stale_client" | "rejected" {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    /Failed to find Server Action|older or newer deployment/i.test(msg)
  ) {
    return "stale_client";
  }
  if (
    /fetch failed|Failed to fetch|Couldn't reach the server|ECONNREFUSED|ENOTFOUND|network|timeout|AbortError|502/i.test(
      msg,
    )
  ) {
    return "unreachable";
  }
  return "rejected";
}
