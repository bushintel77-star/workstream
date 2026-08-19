import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { isClerkConfigured } from "./lib/auth";

export const config = {
  matcher: [
    "/((?!_next|.*\\.(?:ico|png|jpg|jpeg|svg|gif|webp|webmanifest|woff2?|ttf|css|js|map)$).*)",
  ],
};

export default async function proxy(
  req: NextRequest,
  event: NextFetchEvent,
) {
  if (!isClerkConfigured()) {
    return NextResponse.next();
  }
  const { default: clerkHandler } = await import("./middleware.clerk");
  return clerkHandler(req, event);
}
