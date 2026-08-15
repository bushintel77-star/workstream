import { requireSignedIn } from "../../../lib/auth";
import { getWorkspaceLicenseAction } from "../../actions";
import { SettingsLicenseSurface } from "../../../components/SettingsLicenseSurface";

export const dynamic = "force-dynamic";

/**
 * Workspace license + seats. This is the page Stripe checkout returns to
 * (lib/api.ts success/cancel URLs) — previously a 404 trap.
 */
export default async function SettingsLicensePage({
  searchParams,
}: {
  searchParams: Promise<{ studio?: string; seats?: string }>;
}) {
  await requireSignedIn();
  const sp = await searchParams;
  const banner = sp.studio
    ? { kind: "studio" as const, result: sp.studio === "success" ? ("success" as const) : ("cancel" as const) }
    : sp.seats
      ? { kind: "seats" as const, result: sp.seats === "success" ? ("success" as const) : ("cancel" as const) }
      : null;

  const res = await getWorkspaceLicenseAction();

  return (
    <SettingsLicenseSurface
      license={res?.license ?? null}
      studioPriceConfigured={res?.studio_price_configured ?? false}
      seatPriceConfigured={res?.seat_price_configured ?? false}
      banner={banner}
    />
  );
}
