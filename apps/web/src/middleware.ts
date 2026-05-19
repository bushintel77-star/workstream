import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/",
  "/projects(.*)",
  "/settings(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!process.env.CLERK_SECRET_KEY) return;
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|.*\\.(?:ico|png|jpg|jpeg|svg|gif|webp|webmanifest|woff2?|ttf|css|js|map)$).*)",
  ],
};
