import { redirect } from "next/navigation";

/**
 * The marketing landing ("Acquire Site Truth") was removed — it presented
 * hardcoded telemetry and pipeline mock data as if live (zero-mock-data law).
 * The app entry is the operator dashboard; the address composer + site-truth
 * pipeline live there against real data.
 */
export default function RootPage() {
  redirect("/home");
}
