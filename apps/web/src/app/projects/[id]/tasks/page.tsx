import { requireProject } from "../../../../lib/project-guard";
import {
  listCrew,
  listTasks,
  type Task,
  type TaskStatus,
} from "../../../../lib/api";
import s from "../../../../styles/app.module.css";
import p from "../project.module.css";
import { createTaskAction } from "../../../actions";
import { NotFoundPage, ProjectMasthead } from "../ProjectShell";
import { SubmitButton } from "../../../../components/SubmitButton";
import { TaskStatusSelect } from "../../../../components/TaskStatusSelect";

export const dynamic = "force-dynamic";

const COLUMNS: Array<{ status: TaskStatus; label: string }> = [
  { status: "pending", label: "Pending" },
  { status: "in_progress", label: "In progress" },
  { status: "blocked", label: "Blocked" },
  { status: "done", label: "Done" },
];

const PRIORITY_PILL: Record<string, string> = {
  low: "",
  medium: "",
  high: "",
  critical: "",
};

export default async function TasksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await requireProject(id);
  if (!project) return <NotFoundPage message="Project not found." />;

  const [tasks, crew] = await Promise.all([
    listTasks(id),
    listCrew().catch(() => []),
  ]);
  const activeCrew = crew.filter((c) => c.active);
  const byStatus = new Map<TaskStatus, Task[]>();
  for (const c of COLUMNS) byStatus.set(c.status, []);
  for (const t of tasks) {
    if (t.status === "cancelled") continue;
    const list = byStatus.get(t.status);
    if (list) list.push(t);
  }

  return (
    <main className={s.page}>
      <ProjectMasthead project={project} active="tasks" />

      <h1 className={s.headline}>Tasks</h1>
      <p className={s.lede}>
        Crew dispatch board. Change a task&apos;s status with the dropdown —
        moves are saved instantly. Tasks from dictation or design land in
        Pending.
      </p>

      <form action={createTaskAction} className={p.taskNewForm}>
        <input type="hidden" name="projectId" value={id} />
        <label className={s.label} htmlFor="new-task-title">
          Task title
          <input
            id="new-task-title"
            className={s.input}
            name="title"
            type="text"
            placeholder="New task — e.g. Set out front bed"
            required
            minLength={1}
          />
        </label>
        {activeCrew.length > 0 ? (
          <select
            className={s.select}
            name="assignee_name"
            defaultValue=""
            aria-label="Assignee"
          >
            <option value="">Unassigned</option>
            {activeCrew.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name} · {c.role}
              </option>
            ))}
          </select>
        ) : (
          <input
            className={s.input}
            name="assignee_name"
            type="text"
            placeholder="Assignee"
          />
        )}
        <select
          className={s.select}
          name="priority"
          defaultValue="medium"
          aria-label="Task priority"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <SubmitButton className={s.btn} pendingLabel="Adding…">
          Add task
        </SubmitButton>
      </form>

      <div className={p.kanban}>
        {COLUMNS.map((col) => {
          const items = byStatus.get(col.status) ?? [];
          return (
            <div key={col.status} className={p.column}>
              <div className={p.columnHead}>
                <span className={p.columnTitle}>{col.label}</span>
                <span className={p.columnCount}>{items.length}</span>
              </div>
              {items.length === 0 ? (
                <div className={p.columnEmpty}>—</div>
              ) : (
                items.map((t) => (
                  <div key={t.id} className={p.taskCard}>
                    <span className={p.taskTitle}>{t.title}</span>
                    <div className={p.taskMeta}>
                      <span className={p.taskAssignee}>
                        {t.assignee_name ?? "Unassigned"} · {t.priority}
                      </span>
                    </div>
                    <TaskStatusSelect
                      projectId={id}
                      taskId={t.id}
                      status={t.status}
                      className={`${s.select} ${p.taskStatusSelect}`}
                    />
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
