import type { Design } from "../lib/api";
import s from "../styles/app.module.css";
import p from "../app/projects/[id]/project.module.css";
import d from "./design.module.css";

type Zone = Design["proposal"]["zones"][number];

function isRealAerial(uri: string): boolean {
  return uri.startsWith("http") && !uri.includes("placeholder");
}

function zoneStats(z: Zone) {
  return [
    z.plantings.length > 0 ? `${z.plantings.length} planting` : null,
    z.hardscape.length > 0 ? `${z.hardscape.length} hardscape` : null,
    z.lighting.length > 0 ? `${z.lighting.length} lighting` : null,
    z.irrigation.length > 0 ? `${z.irrigation.length} irrigation` : null,
  ].filter(Boolean) as string[];
}

function ZoneCard({
  zone,
  index,
  tier1,
}: {
  zone: Zone;
  index: number;
  tier1: boolean;
}) {
  const chips = zoneStats(zone);

  return (
    <li
      className={`${d.zoneCard} ${tier1 ? d.zoneCardTier1 : ""}`}
      id={`zone-${zone.id}`}
    >
      <header className={d.zoneHeader}>
        <span className={d.zoneIndex}>
          Zone {String(index + 1).padStart(2, "0")}
        </span>
        <h3 className={d.zoneName}>{zone.name}</h3>
      </header>

      <p className={d.zoneTreatment}>{zone.treatment}</p>

      {chips.length > 0 && (
        <div className={d.chips}>
          {chips.map((c) => (
            <span key={c} className={d.chip}>
              {c}
            </span>
          ))}
        </div>
      )}

      <div className={d.specBlock}>
        {zone.plantings.length > 0 && (
          <>
            <div className={d.specTitle}>Plantings</div>
            <ul className={d.specList}>
              {zone.plantings.map((pl, i) => (
                <li key={i} className={d.specRow}>
                  <span className={d.specLabel}>{pl.common_name}</span>
                  <span className={d.specDetail}>{pl.species}</span>
                  <span className={d.specQty}>
                    {pl.count} · {pl.form}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {zone.hardscape.length > 0 && (
          <>
            <div className={d.specTitle}>Hardscape</div>
            <ul className={d.specList}>
              {zone.hardscape.map((h, i) => (
                <li key={i} className={d.specRow}>
                  <span className={d.specLabel}>{h.item}</span>
                  <span className={d.specQty}>
                    {h.qty} {h.unit}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {zone.lighting.length > 0 && (
          <>
            <div className={d.specTitle}>Lighting</div>
            <ul className={d.specList}>
              {zone.lighting.map((l, i) => (
                <li key={i} className={d.specRow}>
                  <span className={d.specLabel}>{l.fixture}</span>
                  <span className={d.specQty}>{l.count} ea</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {zone.irrigation.length > 0 && (
          <>
            <div className={d.specTitle}>Irrigation</div>
            <ul className={d.specList}>
              {zone.irrigation.map((ir, i) => (
                <li key={i} className={d.specRow}>
                  <span className={d.specLabel}>{ir.item}</span>
                  <span className={d.specQty}>
                    {ir.qty} {ir.unit}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </li>
  );
}

export function DesignProposalView({
  design,
  aerialUri,
  tier1,
}: {
  design: Design;
  aerialUri: string | null;
  tier1: boolean;
}) {
  const showAerial = aerialUri && isRealAerial(aerialUri);

  return (
    <div className={d.layout}>
      <section className={`${d.hero} ${showAerial ? d.heroWithVisual : ""}`}>
        <article className={d.rationaleCard}>
          <p className={d.rationaleKicker}>Design intent</p>
          <p className={d.rationaleText}>{design.rationale}</p>
        </article>
        <aside className={d.visual}>
          {showAerial ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={aerialUri} alt="Site aerial" />
          ) : (
            <div className={d.visualPlaceholder}>
              Site render or survey photo appears here after capture
            </div>
          )}
        </aside>
      </section>

      <section>
        <h2 className={s.sectionHeading}>
          Zones ({design.proposal.zones.length})
        </h2>
        <ul className={d.zoneGrid}>
          {design.proposal.zones.map((z, i) => (
            <ZoneCard key={z.id} zone={z} index={i} tier1={tier1} />
          ))}
        </ul>
      </section>

      {design.gaps.length > 0 && (
        <section className={d.gaps}>
          <h2 className={s.sectionHeading}>Open decisions</h2>
          {design.gaps.map((g, i) => (
            <div key={i} className={`${p.finding} ${p.findingAdvisory}`}>
              <div className={p.findingHead}>
                <span className={p.findingLocation}>{g.zone}</span>
                <span className={`${s.pill} ${s.pillWarn}`}>Gap</span>
              </div>
              <p className={p.findingStatement}>{g.description}</p>
              <p className={p.findingAction}>
                Proposed: {g.proposed_fill} — {g.rationale}
              </p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
