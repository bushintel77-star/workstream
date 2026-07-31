import Link from "next/link";
import { ConfirmPinClient } from "./ConfirmPinClient";
import s from "../../styles/app.module.css";

export const dynamic = "force-dynamic";

export default async function ConfirmPinPage({
  searchParams,
}: {
  searchParams: Promise<{
    address?: string;
    lat?: string;
    lng?: string;
  }>;
}) {
  const q = await searchParams;
  const address = String(q.address ?? "").trim();
  const lat = Number(q.lat);
  const lng = Number(q.lng);

  if (address.length < 5 || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return (
      <main className={s.pageNarrow}>
        <h1 className={s.headline}>Missing address</h1>
        <p className={s.lede}>
          Pick an address from the dashboard list first.
        </p>
        <Link href="/home" className={s.btn}>
          Back to projects
        </Link>
      </main>
    );
  }

  return <ConfirmPinClient address={address} lat={lat} lng={lng} />;
}
