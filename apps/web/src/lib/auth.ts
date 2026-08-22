import { redirect } from "next/navigation";

export const clerkEnabled =
  (process.env.CLERK_SECRET_KEY?.startsWith("sk_") ?? false) &&
  (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_") ?? false);

export function isClerkConfigured(): boolean {
  return clerkEnabled;
}

export function isAuthRequired(): boolean {
  /* Bracket access so Next does not inline the flag at image build time.
   * Unset in production is fail-closed; AUTH_REQUIRED=false is the explicit
   * bootstrap override until Clerk keys are on the service. */
  const flag = process.env["AUTH_REQUIRED"];
  if (flag === "false") return false;
  if (flag === "true") return true;
  return process.env.NODE_ENV === "production";
}

export function isClerkRequired(): boolean {
  return isAuthRequired() && !clerkEnabled;
}

export async function requireSignedIn(): Promise<{ userId: string }> {
  if (!clerkEnabled) {
    if (isClerkRequired()) {
      throw new Error(
        "CLERK_SECRET_KEY is required in production. Configure Clerk on the web service.",
      );
    }
    return { userId: process.env.DEV_USER_ID ?? "dev-user" };
  }
  const { auth } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  return { userId };
}
