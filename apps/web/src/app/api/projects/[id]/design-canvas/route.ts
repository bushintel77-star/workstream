import { NextRequest, NextResponse } from "next/server";
import { UpsertDesignCanvasSchema } from "@workstream/contracts";
import { getApiUrl, upstreamAuthHeaders } from "../../../../../lib/upstream-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stable canvas autosave endpoint — avoids Next.js Server Action ID churn
 * after deploys (which previously surfaced as "Server rejected the save").
 */
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json(
      { error: "Missing project — cannot save site plan" },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = UpsertDesignCanvasSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        message: parsed.error.issues[0]?.message ?? "Site plan failed validation",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const upstream = `${getApiUrl()}/projects/${id}/design-canvas`;
  const headers = await upstreamAuthHeaders({
    "content-type": "application/json",
  });

  let res: Response;
  try {
    res = await fetch(upstream, {
      method: "PUT",
      headers,
      body: JSON.stringify(parsed.data),
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
      "content-type": res.headers.get("content-type") ?? "application/json",
    },
  });
}
