import { NextRequest, NextResponse } from "next/server";
import { getApiUrl, upstreamAuthHeaders } from "../../../../../../lib/upstream-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; fileId: string }> },
) {
  const { id, fileId } = await ctx.params;
  const upstream = `${getApiUrl()}/projects/${id}/files/${fileId}`;
  const headers = await upstreamAuthHeaders();
  const res = await fetch(upstream, { method: "DELETE", headers });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/json",
    },
  });
}
