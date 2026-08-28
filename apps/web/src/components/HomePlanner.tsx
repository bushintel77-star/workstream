"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  createTaskAction,
  getWeatherAction,
  listProjectTasksAction,
  updateTaskStatusAction,
} from "../app/actions";
import type { Task, WeatherForecast } from "../lib/api";
import type { DashboardProject } from "./DashboardProjects";
import home from "../app/home.module.css";

type Props = {
  projects: DashboardProject[];
};

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
  // Mounted gate for the rendered clock: the server stamps its request time
  // (e.g. 08:35) while hydration re-renders the client's own now (08:38) —
  // a text mismatch React flags as a hydration error. useSyncExternalStore
  // is false on the server and true from the first client render (no
  // setState-in-effect), so the time/date lines paint only client-side.
  const clockMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [weather, setWeather] = useState<WeatherForecast | null>(null);
  const [taskInput, setTaskInput] = useState("");
  const [savingTask, setSavingTask] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Fetch weather for the most recent active project (or first project)
  const weatherProjectId = useMemo(() => {
    const active = projects.find((p) => p.status === "active");
    return active?.id ?? projects[0]?.id ?? null;
  }, [projects]);

  const reminderProject = useMemo(() => {
    const active = projects.find((p) => p.status === "active");
    return active ?? projects[0] ?? null;
  }, [projects]);
  const reminderProjectId = reminderProject?.id ?? null;

  useEffect(() => {
    if (!weatherProjectId) return;
    let cancelled = false;
    void getWeatherAction(weatherProjectId)
      .then((w) => {
        if (!cancelled) setWeather(w);
      })
      .catch(() => {
        // Action transport failure — the widget renders its own
        // "Forecast unavailable" fallback either way.
      });
    return () => {
      cancelled = true;
    };
  }, [weatherProjectId]);

  // Reset the reminders state during render when the project changes — this is
  // the React-19 idiom for "reset state when a prop/dependency changes" (see
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders).
  // Doing it here avoids the set-state-in-effect anti-pattern: the effect below
  // is a pure fetch that only mutates state from async callbacks, never
  // synchronously in its body.
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const prevReminderProjectIdRef = useRef<string | null>(reminderProjectId);
  if (prevReminderProjectIdRef.current !== reminderProjectId) {
    prevReminderProjectIdRef.current = reminderProjectId;
    // Project changed (or cleared) → reset reminders to the new project's
    // pre-fetch state. Done during render (the React-19 idiom) so the effect
    // below is a pure fetch that only mutates state from async callbacks.
    setTasks([]);
    setTaskError(null);
    // A new (non-null) project means a fetch is pending; a null project means
    // nothing is loading. Set this here, not in the effect, to keep the effect
    // side-effect-free at sync time.
    setLoadingTasks(reminderProjectId !== null);
  }

  useEffect(() => {
    if (!reminderProjectId) return;
    let cancelled = false;
    void listProjectTasksAction(reminderProjectId)
      .then((list) => {
        if (!cancelled) setTasks(list);
      })
      .catch((err) => {
        if (cancelled) return;
        setTasks([]);
        setTaskError(
          err instanceof Error ? err.message : "Could not load reminders",
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingTasks(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reminderProjectId]);

  const season = seasonForMonth(now.getMonth());
  const seasonInfo = SEASONS.find((s) => s.key === season)!;
  const seasonPlantings = SEASON_PLANTINGS[season];

  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const cells = monthGrid(now.getFullYear(), now.getMonth());

  const activeProjects = projects.filter((p) => p.status === "active");
  const reviewProjects = projects.filter((p) => p.status === "review");
  const draftProjects = projects.filter((p) => p.status === "draft");
  const totalValue = projects.reduce((sum, p) => sum + (p.costTotal ?? 0), 0);

  const openTasks = tasks.filter(
    (task) => task.status !== "done" && task.status !== "cancelled",
  );
  const doneTasks = tasks.filter((task) => task.status === "done");

  function refreshTasks(projectId: string) {
    return listProjectTasksAction(projectId).then((list) => {
      setTasks(list);
      return list;
    });
  }

  function addTask(e: React.FormEvent) {
    e.preventDefault();
    const title = taskInput.trim();
    if (!title || !reminderProjectId) return;
    const fd = new FormData();
    fd.set("projectId", reminderProjectId);
    fd.set("title", title);
    fd.set("priority", "medium");
    fd.set("source", "manual");
    setSavingTask(true);
    setTaskError(null);
    void createTaskAction(fd)
      .then(() => refreshTasks(reminderProjectId))
      .then(() => setTaskInput(""))
      .catch((err) => {
        setTaskError(
          err instanceof Error ? err.message : "Could not create reminder",
        );
      })
      .finally(() => {
        setSavingTask(false);
      });
  }

  function markTaskStatus(taskId: string, status: "done" | "cancelled") {
    if (!reminderProjectId) return;
    const fd = new FormData();
    fd.set("projectId", reminderProjectId);
    fd.set("taskId", taskId);
    fd.set("status", status);
    setSavingTask(true);
    setTaskError(null);
    void updateTaskStatusAction(fd)
      .then(() => refreshTasks(reminderProjectId))
      .catch((err) => {
        setTaskError(
          err instanceof Error ? err.message : "Could not update reminder",
        );
      })
      .finally(() => {
        setSavingTask(false);
      });
  }

  const todayWeather = weather?.days?.[0];

  return (
    <div className={home.planner}>
      {/* --- Date + Time --- */}
      <section className={home.widget} data-accent="blue">
        <p className={home.widgetLabel}>Today</p>
        <p className={home.dateLine}>{clockMounted ? DAY_FMT.format(now) : ""}</p>
        <p className={home.timeLine}>{clockMounted ? TIME_FMT.format(now) : ""}</p>
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
        <p className={home.focusEmpty}>
          {reminderProject
            ? `Synced to ${reminderProject.projectName}`
            : "No project available."}
        </p>
        {taskError ? <p className={home.focusEmpty}>{taskError}</p> : null}
        {loadingTasks ? (
          <p className={home.focusEmpty}>Loading reminders…</p>
        ) : null}
        <ul className={home.reminderList}>
          {openTasks.length > 0 ? (
            openTasks.slice(0, 3).map((task) => (
              <li key={task.id} className={home.reminderRow}>
                <span className={home.reminderDot} aria-hidden />
                <span className={home.reminderText}>{task.title}</span>
              </li>
            ))
          ) : (
            <li className={home.focusEmpty}>Nothing open right now.</li>
          )}
        </ul>
      </section>

      {/* --- Calendar --- */}
      {/* Mounted gate — same law as the clock lines: the server stamps its
          request-time month while hydration re-renders the client's, and a
          month/day boundary between the two is a hydration mismatch. The
          grid paints only client-side. */}
      <section className={home.widget} data-accent="blue">
        <p className={home.widgetLabel}>
          {clockMounted ? `${MONTH_NAME.format(now)} ${now.getFullYear()}` : "Calendar"}
        </p>
        <div className={home.calGrid}>
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span key={i} className={home.calHead}>
              {d}
            </span>
          ))}
          {clockMounted
            ? cells.map((date, i) => {
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
              })
            : null}
        </div>
      </section>

      {/* --- Season now --- */}
      <section className={home.widget} data-accent="green">
        <p className={home.widgetLabel}>
          Season{clockMounted ? ` · ${seasonInfo.label}` : ""}
        </p>
        {clockMounted ? (
          <>
            <p className={home.seasonMonths}>{seasonInfo.months}</p>
            <ul className={home.seasonList}>
              {seasonPlantings.map((plant) => (
                <li key={plant} className={home.seasonRow}>
                  {plant}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      {/* --- To-do --- */}
      <section className={home.widget} data-accent="red">
        <p className={home.widgetLabel}>
          To-do · {openTasks.length} open
        </p>
        <form className={home.todoForm} onSubmit={addTask}>
          <input
            className={home.todoInput}
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            placeholder="Add a task"
            aria-label="Add a task"
            maxLength={120}
            disabled={!reminderProjectId || savingTask}
          />
          <button
            type="submit"
            className={home.todoAdd}
            aria-label="Add task"
            disabled={!reminderProjectId || savingTask}
          >
            +
          </button>
        </form>
        {openTasks.length > 0 ? (
          <ul className={home.todoList}>
            {openTasks.slice(0, 6).map((task) => (
              <li key={task.id} className={home.todoRow}>
                <button
                  type="button"
                  className={home.todoCheck}
                  onClick={() => markTaskStatus(task.id, "done")}
                  disabled={savingTask}
                  aria-label={`Mark ${task.title} done`}
                />
                <span className={home.todoText}>{task.title}</span>
                <button
                  type="button"
                  className={home.todoDelete}
                  onClick={() => markTaskStatus(task.id, "cancelled")}
                  disabled={savingTask}
                  aria-label={`Cancel ${task.title}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={home.focusEmpty}>No open tasks.</p>
        )}
        {doneTasks.length > 0 ? (
          <p className={home.todoDoneCount}>{doneTasks.length} done</p>
        ) : null}
      </section>

      {/* --- Project stats --- */}
      <section className={home.widget} data-accent="blue">
        <p className={home.widgetLabel}>Register</p>
        <p className={home.statsBig}>{pad2(projects.length)}</p>
        <p className={home.statsMeta}>
          {activeProjects.length} active · {reviewProjects.length} review ·{" "}
          {draftProjects.length} draft · {tasks.length} reminders
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
