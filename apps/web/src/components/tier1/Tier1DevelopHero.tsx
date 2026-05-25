import lg from "./tier1DevelopHero.module.css";

type Props = {
  address: string;
};

/** Operator develop page — Tier-1 positioning (achromatic + warn kicker). */
export function Tier1DevelopHero({ address }: Props) {
  return (
    <header className={lg.hero} data-testid="tier1-develop-hero">
      <p className={lg.kicker}>Tier-1 architectural massing</p>
      <h2 className={lg.title}>{address}</h2>
      <p className={lg.lede}>
        Architecture locked. Singular-species blocks, bluestone ground plane, concealed
        deck lighting. Indicative sketch and envelope only — confirm on site before
        build.
      </p>
    </header>
  );
}
