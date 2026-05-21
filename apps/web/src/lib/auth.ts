import { redirect } from "next/navigation";

export const clerkEnabled = !!process.env.CLERK_SECRET_KEY;

function authRequired(): boolean {
  if (process.env.AUTH_REQUIRED === "true") return true;
  if (process.env.AUTH_REQUIRED === "false") return false;
  return process.env.NODE_ENV === "production";
}

export function isClerkRequired(): boolean {
  return authRequired() && !clerkEnabled;
}

export async function requireSignedIn(): Promise<{ userId: string }> {
  if (!clerkEnabled) {
    if (isClerkRequired()) {
      throw new Error(
        "CLERK_SECRET_KEY is required in production. Configure Clerk on construct-web.",
      );
    }
    return { userId: process.env.DEV_USER_ID ?? "dev-user" };
  }
  const { auth } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  return { userId };
}
