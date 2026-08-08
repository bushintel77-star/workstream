"use client";

import { useEffect, useMemo, useState } from "react";
import { getWeatherAction } from "../app/actions";
import type { WeatherForecast } from "../lib/api";
import type { DashboardProject } from "./DashboardProjects";
import home from "../app/home.module.css";

type Props = {
  projects: DashboardProject[];
};

type Todo = {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
};

const TODO_KEY = "ws-home-todos";

const SEASONS = [
  { key: "summer", label: "Summer", months: "Dec — Feb" },
  { key: "autumn", label: "Autumn", months: "Mar — May" },
  { key: "winter", label: "Winter", months: "Jun — Aug" },
  { key: "spring", label: "Spring", months: "Sep — Nov" },
];

/** Melbourne seasonal planting — Curtis & Co vocabulary. */
const SEASON_PLANTINGS: Record<string, string[]> = {
  summer: [
    "Pleached hornbeam — establish before heat",
    "Lomandra tanika — drought-ready",
    "Star jasmine — water deep",
  ],
  autumn: [
    "Pleached hornbeam — peak planting",
    "Crepe myrtle — root before winter",
    "Liriope — mass plant now",
  ],
  winter: [
    "Deciduous planting — bare root window",
    "Hellebores — winter interest",
    "Daphne — fragrant shade",
  ],
  spring: [
    "Lomandra — feed + divide",
    "Star jasmine — feed + train",
    "Bluestone mulch — top dress",
  ],
};

function seasonForMonth(month: number): string {
  if (month >= 11 || month <= 1) return "summer";
  if (month >= 2 && month <= 4) return "autumn";
  if (month >= 5 && month <= 7) return "winter";
  return "spring";
}

const DAY_FMT = new Intl.DateTimeFormat("en-AU", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const TIME_FMT = new Intl.DateTimeFormat("en-AU", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const MONTH_NAME = new Intl.DateTimeFormat("en-AU", { month: "long" });

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDay; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function HomePlanner({ projects }: Props) {
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<WeatherForecast | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [todoInput, setTodoInput] = useState("");

  // Tick every minute
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Load todos from localStorage
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TODO_KEY);
      if (raw) setTodos(JSON.parse(raw) as Todo[]);
    } catch {
      // ignore
    }
  }, []);

  // Persist todos
  useEffect(() => {
    try {
      window.localStorage.setItem(TODO_KEY, JSON.stringify(todos));
    } catch {
      // ignore
    }
  }, [todos]);

  // Fetch weather for the most recent active project (or first project)
  const weatherProjectId = useMemo(() => {
    const active = projects.find((p) => p.status === "active");
    return active?.id ?? projects[0]?.id ?? null;
  }, [projects]);

  useEffect(() => {
    if (!weatherProjectId) return;
    let cancelled = false;
    void getWeatherAction(weatherProjectId).then((w) => {
      if (!cancelled) setWeather(w);
    });
    return () => {
      cancelled = true;
    };
  }, [weatherProjectId]);

  const season = seasonForMonth(now.getMonth());
  const seasonInfo = SEASONS.find((s) => s.key === season)!;
  const seasonPlantings = SEASON_PLANTINGS[season];

  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const cells = monthGrid(now.getFullYear(), now.getMonth());

  const activeProjects = projects.filter((p) => p.status === "active");
  const reviewProjects = projects.filter((p) => p.status === "review");
  const draftProjects = projects.filter((p) => p.status === "draft");
  const totalValue = projects.reduce((sum, p) => sum + (p.costTotal ?? 0), 0);

  const openTodos = todos.filter((t) => !t.done);
  const doneTodos = todos.filter((t) => t.done);

  function addTodo(e: React.FormEvent) {
    e.preventDefault();
    const text = todoInput.trim();
    if (!text) return;
    setTodos((current) => [
      {
        id: `${Date.now()}`,
        text,
        done: false,
        createdAt: Date.now(),
      },
      ...current,
    ]);
    setTodoInput("");
  }

  function toggleTodo(id: string) {
    setTodos((current) =>
      current.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );
  }

  function deleteTodo(id: string) {
    setTodos((current) => current.filter((t) => t.id !== id));
  }

  const todayWeather = weather?.days?.[0];

  return (
    <div className={home.planner}>
      {/* --- Date + Time --- */}
      <section className={home.widget} data-accent="blue">
        <p className={home.widgetLabel}>Today</p>
        <p className={home.dateLine}>{DAY_FMT.format(now)}</p>
        <p className={home.timeLine}>{TIME_FMT.format(now)}</p>
      </section>

      {/* --- Weather --- */}
      <section className={home.widget} data-accent="green">
        <p className={home.widgetLabel}>Weather · Melbourne</p>
        {todayWeather ? (
          <>
            <p className={home.weatherTemp}>
              {Math.round(todayWeather.temp_max_c)}
              <span className={home.weatherDeg}>°</span>
            </p>
            <p className={home.weatherMeta}>
              {todayWeather.condition ?? "Fine"}
              {" · "}
              {Math.round(todayWeather.temp_min_c)}° low
              {todayWeather.precipitation_mm > 0
                ? ` · ${todayWeather.precipitation_mm.toFixed(1)}mm rain`
                : ""}
            </p>
            {weather?.days?.slice(1, 4).map((day) => (
              <p key={day.date} className={home.weatherDay}>
                <span>{new Intl.DateTimeFormat("en-AU", { weekday: "short" }).format(new Date(day.date))}</span>
                <span>{Math.round(day.temp_max_c)}°</span>
                <span className={day.precipitation_mm > 0 ? home.weatherRain : ""}>
                  {day.precipitation_mm > 0 ? `${day.precipitation_mm.toFixed(0)}mm` : "—"}
                </span>
              </p>
            ))}
          </>
        ) : (
          <p className={home.weatherMeta}>Forecast unavailable</p>
        )}
      </section>

      {/* --- Today's focus --- */}
      <section className={home.widget} data-accent="red">
        <p className={home.widgetLabel}>Today · focus</p>
        {activeProjects.length === 0 ? (
          <p className={home.focusEmpty}>No active sites today.</p>
        ) : (
          <ul className={home.focusList}>
            {activeProjects.slice(0, 3).map((p) => (
              <li key={p.id} className={home.focusRow}>
                <span className={home.focusName}>{p.projectName}</span>
                <span className={home.focusStage}>{p.stageLabel}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* --- Reminders (review + draft) --- */}
      <section className={home.widget} data-accent="yellow">
        <p className={home.widgetLabel}>Reminders</p>
        <ul className={home.reminderList}>
          {reviewProjects.slice(0, 2).map((p) => (
            <li key={p.id} className={home.reminderRow} data-kind="review">
              <span className={home.reminderDot} aria-hidden />
              <span className={home.reminderText}>
                {p.projectName} — quote review
              </span>
            </li>
          ))}
          {draftProjects.slice(0, 2).map((p) => (
            <li key={p.id} className={home.reminderRow} data-kind="draft">
              <span className={home.reminderDot} aria-hidden />
              <span className={home.reminderText}>
                {p.projectName} — survey pending
              </span>
            </li>
          ))}
          {reviewProjects.length === 0 && draftProjects.length === 0 ? (
            <li className={home.focusEmpty}>Nothing overdue.</li>
          ) : null}
        </ul>
      </section>

      {/* --- Calendar --- */}
      <section className={home.widget} data-accent="blue">
        <p className={home.widgetLabel}>
          {MONTH_NAME.format(now)} {now.getFullYear()}
        </p>
        <div className={home.calGrid}>
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span key={i} className={home.calHead}>
              {d}
            </span>
          ))}
          {cells.map((date, i) => {
            if (!date) return <span key={i} className={home.calCell} />;
            const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
            const isToday = key === todayKey;
            return (
              <span
                key={i}
                className={`${home.calCell} ${isToday ? home.calToday : ""}`}
              >
                {date.getDate()}
              </span>
            );
          })}
        </div>
      </section>

      {/* --- Season now --- */}
      <section className={home.widget} data-accent="green">
        <p className={home.widgetLabel}>Season · {seasonInfo.label}</p>
        <p className={home.seasonMonths}>{seasonInfo.months}</p>
        <ul className={home.seasonList}>
          {seasonPlantings.map((plant) => (
            <li key={plant} className={home.seasonRow}>
              {plant}
            </li>
          ))}
        </ul>
      </section>

      {/* --- To-do --- */}
      <section className={home.widget} data-accent="red">
        <p className={home.widgetLabel}>
          To-do · {openTodos.length} open
        </p>
        <form className={home.todoForm} onSubmit={addTodo}>
          <input
            className={home.todoInput}
            value={todoInput}
            onChange={(e) => setTodoInput(e.target.value)}
            placeholder="Add a task"
            aria-label="Add a task"
            maxLength={120}
          />
          <button type="submit" className={home.todoAdd} aria-label="Add task">
            +
          </button>
        </form>
        {openTodos.length > 0 ? (
          <ul className={home.todoList}>
            {openTodos.slice(0, 6).map((t) => (
              <li key={t.id} className={home.todoRow}>
                <button
                  type="button"
                  className={home.todoCheck}
                  onClick={() => toggleTodo(t.id)}
                  aria-label={`Mark ${t.text} done`}
                />
                <span className={home.todoText}>{t.text}</span>
                <button
                  type="button"
                  className={home.todoDelete}
                  onClick={() => deleteTodo(t.id)}
                  aria-label={`Delete ${t.text}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={home.focusEmpty}>No open tasks.</p>
        )}
        {doneTodos.length > 0 ? (
          <p className={home.todoDoneCount}>{doneTodos.length} done</p>
        ) : null}
      </section>

      {/* --- Project stats --- */}
      <section className={home.widget} data-accent="blue">
        <p className={home.widgetLabel}>Register</p>
        <p className={home.statsBig}>{pad2(projects.length)}</p>
        <p className={home.statsMeta}>
          {activeProjects.length} active · {reviewProjects.length} review ·{" "}
          {draftProjects.length} draft
        </p>
        {totalValue > 0 ? (
          <p className={home.statsValue}>
            {new Intl.NumberFormat("en-AU", {
              style: "currency",
              currency: "AUD",
              maximumFractionDigits: 0,
            }).format(totalValue)}{" "}
            <span className={home.statsValueLabel}>pipeline</span>
          </p>
        ) : null}
      </section>
    </div>
  );
}
