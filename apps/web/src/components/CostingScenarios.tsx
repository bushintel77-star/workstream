"use client";

import { useRouter } from "next/navigation";
import styles from "./scenarioPicker.module.css";

type Scenario = "lean" | "standard" | "buffer";

const META: Record<Scenario, { label: string; note: string }> = {
  lean: {
    label: "Lean",
    note: "Competitive — disclosed substitutions on pavers, bin, lights.",
  },
  standard: {
    label: "Standard",
    note: "Recommended scope and stock. Default client quote.",
  },
  buffer: {
    label: "Buffer",
    note: "Premium stock + extra contingency.",
  },
};

export function CostingScenarios({
  projectId,
  active,
  totals,
}: {
  projectId: string;
  active: Scenario;
  totals: Partial<Record<Scenario, number>>;
}) {
  const router = useRouter();

  const aud0 = (n: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <div className={styles.row} role="tablist" aria-label="Price scenarios">
      {(["lean", "standard", "buffer"] as const).map((id) => {
        const total = totals[id];
        if (total === undefined) return null;
        const selected = active === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={`${styles.card} ${selected ? styles.cardActive : ""}`}
            onClick={() =>
              router.push(`/projects/${projectId}/costing?scenario=${id}`)
            }
          >
            <span className={styles.label}>{META[id].label}</span>
            <span className={styles.total}>{aud0(total)}</span>
            <span className={styles.note}>{META[id].note}</span>
          </button>
        );
      })}
    </div>
  );
}
