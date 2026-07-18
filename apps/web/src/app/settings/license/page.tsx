import { getWorkspaceLicenseApi } from "../../../lib/api";
import s from "../../../styles/app.module.css";
import { SettingsMasthead } from "../SettingsShell";
import { LicensePanel } from "../../../components/LicensePanel";
import { SettingsUpgradeToast } from "../../../components/SettingsUpgradeToast";

export const dynamic = "force-dynamic";

export default async function LicenseSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ studio?: string; seats?: string }>;
}) {
  const sp = await searchParams;
  let loadError: string | null = null;
  let payload: Awaited<ReturnType<typeof getWorkspaceLicenseApi>> | null = null;
  try {
    payload = await getWorkspaceLicenseApi();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Could not load license.";
  }

  const toastStatus = sp.studio ?? sp.seats;

  return (
    <main className={s.pageNarrow}>
      <SettingsUpgradeToast status={toastStatus} />
      <SettingsMasthead active="license" subtitle="License" />

      <h1 className={s.headline}>Design &amp; Build License</h1>
      <p className={s.lede}>
        Auth is Clerk. This license gates live integrations and operator seats
        for your workspace.
      </p>

      {loadError ? (
        <div className={s.error}>Couldn&apos;t load license: {loadError}</div>
      ) : null}

      {payload ? (
        <LicensePanel
          license={payload.license}
          studioPriceConfigured={payload.studio_price_configured}
          seatPriceConfigured={payload.seat_price_configured}
        />
      ) : null}
    </main>
  );
}
