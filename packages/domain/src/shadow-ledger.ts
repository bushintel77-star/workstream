import type { ProjectOrchestrationWorld } from "@workstream/contracts";

export type ShadowLedgerIntensity = "off" | "subtle" | "prominent";

export type ShadowAlternative = {
  id: string;
  label: string;
  detail: string;
  save_aud: number;
  kind: "material" | "geometry" | "risk" | "labour";
  apply_hint?: string;
};

const aud = (n: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);

/** Quiet next-best-option proposals from the live orchestration world. */
export function proposeShadowAlternatives(
  world: ProjectOrchestrationWorld,
): ShadowAlternative[] {
  const out: ShadowAlternative[] = [];

  const lightingLines = world.live_bom.filter(
    (l) =>
      l.label.toLowerCase().includes("light") ||
      l.sku?.toLowerCase().includes("light"),
  );
  const lightingSpatial = world.spatial_facts.filter(
    (f) => f.layer === "lighting",
  );
  const lightingTotal = lightingLines.reduce((s, l) => s + l.total, 0);
  if (lightingTotal > 0 || lightingSpatial.length > 0) {
    const base = lightingTotal > 0 ? lightingTotal : 2400;
    const save = Math.round(base * 0.12);
    if (save >= 80) {
      out.push({
        id: "alt-solar-lighting",
        label: `Alt: Solar – save ${aud(save)}`,
        detail:
          "Swap hard-wired path lighting for solar stakes where coverage allows. Keeps night presence with lower install labour.",
        save_aud: save,
        kind: "material",
        apply_hint: "Review lighting fixtures; keep transformer if mixed.",
      });
    }
  }

  const hardscape = world.spatial_facts.filter((f) => f.layer === "hardscape");
  const hardArea = hardscape.reduce((s, f) => s + f.area_m2, 0);
  const hardPrimary = world.live_bom.filter(
    (l) =>
      l.tier === "primary" &&
      l.source_object_ids.some((id) => hardscape.some((h) => h.id === id)),
  );
  const hardTotal = hardPrimary.reduce((s, l) => s + l.total, 0);
  if (hardArea > 20 || hardTotal > 1500) {
    const base = hardTotal > 0 ? hardTotal : hardArea * 180;
    const save = Math.round(base * 0.08);
    if (save >= 100) {
      out.push({
        id: "alt-permeable-paving",
        label: `Alt: Permeable – save ${aud(save)}`,
        detail:
          "Use permeable paving on secondary paths to cut base depth and stormwater fees while keeping the walk network.",
        save_aud: save,
        kind: "geometry",
        apply_hint: "Apply on secondary paths first; keep bluestone on primary axis.",
      });
    }
  }

  const critical = world.risks.filter((r) => r.severity === "critical");
  if (critical.length > 0) {
    const feeLines = world.live_bom.filter((l) => l.tier === "fee");
    const feeTotal = feeLines.reduce((s, l) => s + l.total, 0);
    const save = Math.max(850, Math.round(feeTotal * 0.35));
    out.push({
      id: "alt-setback-geometry",
      label: `Alt: Setback – save ${aud(save)}`,
      detail: `${critical[0]!.title}. Pull hardscape clear of conflict zones to drop engineer/permit hold lines.`,
      save_aud: save,
      kind: "risk",
      apply_hint: "Nudge geometry outside TRP / height thresholds, then re-estimate.",
    });
  }

  return out.sort((a, b) => b.save_aud - a.save_aud).slice(0, 3);
}
