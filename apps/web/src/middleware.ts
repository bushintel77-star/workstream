import {
  clerkMiddleware,
  createRouteMatcher,
} from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/",
  "/projects(.*)",
  "/settings(.*)",
]);

const authRequired =
  process.env.AUTH_REQUIRED === "true" ||
  (process.env.AUTH_REQUIRED !== "false" &&
    process.env.NODE_ENV === "production");

const clerkConfigured =
  !!process.env.CLERK_SECRET_KEY &&
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

function devBypass(req: NextRequest) {
  if (authRequired && isProtectedRoute(req)) {
    return new Response("Authentication is not configured", { status: 503 });
  }
  return NextResponse.next();
}

export default clerkConfigured
  ? clerkMiddleware(async (auth, req) => {
      if (isProtectedRoute(req)) {
        await auth.protect();
      }
    })
  : devBypass;

export const config = {
  matcher: [
    "/((?!_next|.*\\.(?:ico|png|jpg|jpeg|svg|gif|webp|webmanifest|woff2?|ttf|css|js|map)$).*)",
  ],
};
