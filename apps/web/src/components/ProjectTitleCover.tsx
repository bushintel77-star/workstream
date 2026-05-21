import t from "./project-title-cover.module.css";

export function ProjectTitleCover({
  address,
  kicker = "Landscape project",
  subtitle,
}: {
  address: string;
  kicker?: string;
  subtitle?: string;
}) {
  return (
    <div className={t.cover} role="img" aria-label={`${kicker}: ${address}`}>
      <div className={t.inner}>
        <p className={t.kicker}>{kicker}</p>
        <p className={t.brand}>Curtis &amp; Co</p>
        <h2 className={t.title}>{address}</h2>
        {subtitle ? <p className={t.sub}>{subtitle}</p> : null}
      </div>
    </div>
  );
}
