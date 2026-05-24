"use client";

import Link from "next/link";
import type { EnvelopeBrief, SiteContext } from "../lib/api";
import {
  GARDEN_COPY,
  countOpenTasks,
  deriveSiteNextAction,
  type SiteNextAction,
} from "@workstream/domain";
import type { Project, Task } from "../lib/api";
import s from "./site-hot-links.module.css";

type Props = {
  project: Pick<
    Project,
    "id" | "address" | "status" | "client_name" | "client_email" | "lat" | "lng"
  >;
  siteContext: SiteContext | null;
  tasks: Task[];
  envelope: EnvelopeBrief | null;
  standardTotal: number | null;
  hasSurvey: boolean;
  hasDesign: boolean;
  hasCosting: boolean;
  auditPassed: boolean;
  hasQuote: boolean;
  hasCanvas: boolean;
  weatherRain: boolean;
  weatherWind: boolean;
  onWhatsLeft: () => void;
};

function moneyLine(envelope: EnvelopeBrief | null, standardTotal: number | null) {
  if (envelope && envelope.budget_mid > 0) {
    const f = (n: number) =>
      new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: "AUD",
        maximumFractionDigits: 0,
      }).format(n);
    return `${f(envelope.budget_low)}–${f(envelope.budget_high)}`;
  }
  if (standardTotal != null) {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0,
    }).format(standardTotal);
  }
  return "Run costing";
}

function nextHref(projectId: string, next: SiteNextAction): string {
  switch (next.kind) {
    case "record":
      return `/projects/${projectId}/recordings`;
    case "sketch":
      return `/projects/${projectId}/design`;
    case "survey_ok":
    case "develop":
      return `/projects/${projectId}/design`;
    case "cost":
      return `/projects/${projectId}/costing`;
    case "audit":
      return `/projects/${projectId}/audit`;
    case "quote":
    case "share":
      return `/projects/${projectId}/outputs`;
    default:
      return `/projects/${projectId}`;
  }
}

export function SiteHotLinks({
  project,
  siteContext,
  tasks,
  envelope,
  standardTotal,
  hasSurvey,
  hasDesign,
  hasCosting,
  auditPassed,
  hasQuote,
  hasCanvas,
  weatherRain,
  weatherWind,
  onWhatsLeft,
}: Props) {
  const next = deriveSiteNextAction({
    status: project.status,
    hasSurvey,
    hasDesign,
    hasCosting,
    auditPassed,
    hasQuote,
    hasCanvas,
  });
  const openCount = countOpenTasks(tasks);
  const workToday = weatherRain
    ? GARDEN_COPY.weather.rain
    : weatherWind
      ? GARDEN_COPY.weather.wind
      : GARDEN_COPY.weather.sweet;
  const bite =
    siteContext?.planning_badges
      .slice(0, 2)
      .map((b) => b.label)
      .join(" · ") || "All clear for now";

  return (
    <section className={s.wrap} aria-label="Site shortcuts">
      <Link href={nextHref(project.id, next)} className={s.nextCard}>
        <span className={s.nextKicker}>{GARDEN_COPY.widgets.whatsNext}</span>
        <span className={s.nextLabel}>{next.label}</span>
        {next.sub ? <span className={s.nextSub}>{next.sub}</span> : null}
      </Link>
      <div className={s.grid}>
        <button type="button" className={s.widget} onClick={onWhatsLeft}>
          <span className={s.widgetLabel}>{GARDEN_COPY.widgets.rightJob}</span>
          <span className={s.widgetValue}>
            {project.client_name ?? project.address.split(",")[0]}
          </span>
        </button>
        <button type="button" className={s.widget} onClick={onWhatsLeft}>
          <span className={s.widgetLabel}>{GARDEN_COPY.widgets.workToday}</span>
          <span className={s.widgetValue}>{workToday}</span>
        </button>
        <Link
          href={`/projects/${project.id}/costing`}
          className={s.widget}
        >
          <span className={s.widgetLabel}>{GARDEN_COPY.widgets.money}</span>
          <span className={s.widgetValue}>
            {moneyLine(envelope, standardTotal)}
          </span>
        </Link>
        <button
          type="button"
          className={`${s.widget} ${openCount > 0 ? s.widgetAccent : ""}`}
          onClick={onWhatsLeft}
        >
          <span className={s.widgetLabel}>{GARDEN_COPY.widgets.whatsLeft}</span>
          <span className={s.widgetValue}>
            {GARDEN_COPY.tasks.count(openCount)}
          </span>
        </button>
        <button type="button" className={s.widget} onClick={onWhatsLeft}>
          <span className={s.widgetLabel}>{GARDEN_COPY.widgets.biteLater}</span>
          <span className={s.widgetValue}>{bite}</span>
        </button>
        <Link
          href={`/projects/${project.id}/outputs`}
          className={s.widget}
        >
          <span className={s.widgetLabel}>{GARDEN_COPY.widgets.reachClient}</span>
          <span className={s.widgetValue}>
            {project.client_email ?? "Client handoff"}
          </span>
        </Link>
        <Link
          href={`/projects/${project.id}/design`}
          className={s.widget}
        >
          <span className={s.widgetLabel}>{GARDEN_COPY.widgets.sketch}</span>
          <span className={s.widgetValue}>On the aerial</span>
        </Link>
        <Link href={`/projects/${project.id}/filing`} className={s.widget}>
          <span className={s.widgetLabel}>{GARDEN_COPY.widgets.filing}</span>
          <span className={s.widgetValue}>Swipe gallery</span>
        </Link>
      </div>
    </section>
  );
}
