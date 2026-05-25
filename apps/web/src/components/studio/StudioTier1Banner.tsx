import Link from "next/link";
import { TIER1_WRIGHTS_SAVINGS } from "@workstream/domain";
import t1 from "./studioTier1.module.css";

type Props = {
  projectId: string;
};

function aud(n: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function StudioTier1Banner({ projectId }: Props) {
  return (
    <div className={t1.banner} role="status" data-testid="studio-tier1-banner">
      <div>
        <p className={t1.kicker}>Tier-1 · 36 Wrights Terrace</p>
        <p className={t1.title}>Architectural massing studio</p>
        <p className={t1.meta}>
          Target quote {aud(TIER1_WRIGHTS_SAVINGS.target_total_inc_gst)} incl. GST ·
          net saving {aud(Math.abs(TIER1_WRIGHTS_SAVINGS.net_inc_gst))}
        </p>
      </div>
      <Link href={`/projects/${projectId}/design/develop`} className={t1.link}>
        Develop & zones
      </Link>
    </div>
  );
}
