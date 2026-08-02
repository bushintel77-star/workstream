import { NextRequest, NextResponse } from "next/server";
import { getApiUrl, upstreamAuthHeaders } from "../../../../../lib/upstream-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Plan dissection — auto-cut the finished DesignCanvas into proposed plan-crop
 * ghosts for the Present tab. Proxies to the API; the client converts accepted
 * ghosts into PlanCropPanel entries via the document PUT.
 */
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json(
      { error: "Missing project id" },
      { status: 400 },
    );
  }
  const upstream = `${getApiUrl()}/projects/${id}/presentation-dissect`;
  const headers = await upstreamAuthHeaders({
    "content-type": "application/json",
  });
  let res: Response;
  try {
    res = await fetch(upstream, {
      method: "POST",
      headers,
      body: "{}",
      cache: "no-store",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Couldn't reach the API: ${msg}` },
      { status: 502 },
    );
  }
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type":
        res.headers.get("content-type") ?? "application/json",
    },
  });
}
