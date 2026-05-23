import { requireSignedIn } from "../../lib/auth";
import { getIntegrationSummary } from "../../lib/api";
import { AppNav } from "../../components/AppNav";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSignedIn();
  const summary = await getIntegrationSummary().catch(() => null);
  return (
    <>
      <AppNav summary={summary} brandSub />
      {children}
    </>
  );
}
