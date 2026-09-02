import { redirect } from "next/navigation";
import { requireSignedIn } from "../lib/auth";

export const dynamic = "force-dynamic";

/** Bare root is just an alias — /home is the canonical canvas-first
 * "Projects" surface (AppNav's brand + "Projects" link both point there).
 * Keeping the redirect-to-most-recent + picker logic in one place avoids
 * two copies of the same bootstrap to keep in sync. */
export default async function RootPage() {
  await requireSignedIn();
  redirect("/home");
}
