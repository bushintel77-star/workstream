import { redirect } from "next/navigation";

export const clerkEnabled = !!process.env.CLERK_SECRET_KEY;

export async function requireSignedIn(): Promise<{ userId: string }> {
  if (!clerkEnabled) {
    return { userId: process.env.DEV_USER_ID ?? "dev-user" };
  }
  const { auth } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  return { userId };
}
