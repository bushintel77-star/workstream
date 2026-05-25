import { tier1WrightsTerraceDesign } from "@workstream/domain";
import zc from "./tier1ZoneCards.module.css";

/** Read-only Tier-1 zone massing for site rail / studio. */
export function Tier1ZoneCards() {
  const design = tier1WrightsTerraceDesign({
    address: "36 Wrights Terrace, Prahran VIC 3181",
    mode: "tier1",
  });

  return (
    <ul className={zc.list} aria-label="Tier-1 zones">
      {design.proposal.zones.map((zone, i) => (
        <li key={zone.id} className={zc.card}>
          <span className={zc.index}>Zone {String(i + 1).padStart(2, "0")}</span>
          <span className={zc.name}>{zone.name}</span>
          <p className={zc.treatment}>{zone.treatment}</p>
        </li>
      ))}
    </ul>
  );
}
