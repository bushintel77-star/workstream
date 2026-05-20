import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";

/** Clerk only when both keys are present; otherwise dev-mode passthrough. */
function isClerkConfigured(): boolean {
  const sk = process.env.CLERK_SECRET_KEY;
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return (
    typeof sk === "string" &&
    sk.startsWith("sk_") &&
    typeof pk === "string" &&
    pk.startsWith("pk_")
  );
}

export const config = {
  matcher: [
    "/((?!_next|.*\\.(?:ico|png|jpg|jpeg|svg|gif|webp|webmanifest|woff2?|ttf|css|js|map)$).*)",
  ],
};

export default async function middleware(
  req: NextRequest,
  event: NextFetchEvent,
) {
  if (!isClerkConfigured()) {
    return NextResponse.next();
  }
  const { default: clerkHandler } = await import("./middleware.clerk");
  return clerkHandler(req, event);
}
