import type { SiteContext, TitlePlanningBadge } from "../lib/api";
import r from "./site-context-ribbon.module.css";

function ChipIcon({ category }: { category: TitlePlanningBadge["category"] }) {
  if (category === "heritage") {
    return (
      <svg className={r.icon} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 20h16M6 20V9l6-5 6 5v11"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9 14h6"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
    );
  }
  if (category === "stormwater") {
    return (
      <svg className={r.icon} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 3v12M8 11c0-3 2-5 4-5s4 2 4 5M6 18h12"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (category === "tree_protection") {
    return (
      <svg className={r.icon} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="9" r="4" stroke="currentColor" strokeWidth="1.75" />
        <path
          d="M6 20c2-4 4-5 6-5s4 1 6 5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (category === "council") {
    return (
      <svg className={r.icon} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect
          x="5"
          y="3"
          width="14"
          height="18"
          rx="1"
          stroke="currentColor"
          strokeWidth="1.75"
        />
        <path d="M9 8h6M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg className={r.icon} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 8v5l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function severityClass(severity: TitlePlanningBadge["severity"]): string {
  if (severity === "likely") return r.chipLikely;
  if (severity === "clear") return r.chipClear;
  return r.chipReview;
}

function categoryClass(category: TitlePlanningBadge["category"]): string {
  if (category === "heritage") return r.chipHeritage;
  if (category === "stormwater") return r.chipStorm;
  if (category === "tree_protection") return r.chipTree;
  return "";
}

export function SiteContextRibbon({ context }: { context: SiteContext }) {
  const { season, sun, planning_badges, weather_note } = context;

  return (
    <div className={r.ribbon} aria-label="Site season, sun, and planning overlays">
      <span className={`${r.chip} ${r.chipSeason}`}>
        <svg className={r.icon} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
          <path
            d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        {season.label}
        <span className={r.detail}>· {season.month}</span>
      </span>

      <span className={`${r.chip} ${r.chipSun}`}>
        <svg className={r.icon} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="5" fill="currentColor" opacity="0.35" />
          <path
            d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        Sun {sun.now_azimuth_label} {sun.now_altitude_deg}°
        <span className={r.detail}>
          · {sun.sunrise_local}–{sun.sunset_local} ({sun.daylight_hours}h)
        </span>
      </span>

      {weather_note ? (
        <span className={r.chip}>
          <span className={r.detail}>Today {weather_note}</span>
        </span>
      ) : null}

      {planning_badges.map((b) => (
        <span
          key={b.id}
          className={`${r.chip} ${severityClass(b.severity)} ${categoryClass(b.category)}`}
          title={`${b.label} — confirm on planning certificate`}
        >
          <ChipIcon category={b.category} />
          {b.label}
        </span>
      ))}
    </div>
  );
}
