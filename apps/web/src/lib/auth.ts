import { redirect } from "next/navigation";

export const clerkEnabled =
  (process.env.CLERK_SECRET_KEY?.startsWith("sk_") ?? false) &&
  (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_") ?? false);

export async function requireSignedIn(): Promise<{ userId: string }> {
  if (!clerkEnabled) {
    return { userId: process.env.DEV_USER_ID ?? "dev-user" };
  }
  const { auth } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  return { userId };
}
