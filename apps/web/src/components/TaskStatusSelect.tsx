"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTaskStatusAction } from "../app/actions";
import { useToast } from "./ToastHost";

type TaskStatus = "pending" | "in_progress" | "blocked" | "done" | "cancelled";

const OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

export function TaskStatusSelect({
  projectId,
  taskId,
  status,
  className,
}: {
  projectId: string;
  taskId: string;
  status: TaskStatus;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  return (
    <select
      className={className}
      defaultValue={status}
      disabled={pending}
      aria-busy={pending ? "true" : "false"}
      aria-label="Change task status"
      onChange={(e) => {
        const next = e.target.value as TaskStatus;
        if (next === status) return;
        const fd = new FormData();
        fd.set("projectId", projectId);
        fd.set("taskId", taskId);
        fd.set("status", next);
        startTransition(async () => {
          try {
            await updateTaskStatusAction(fd);
            router.refresh();
            const label =
              OPTIONS.find((o) => o.value === next)?.label ?? next;
            toast.show(`Moved to ${label}`, "success", 2500);
          } catch (err) {
            const msg =
              err instanceof Error ? err.message : "Could not update task";
            toast.show(msg, "error", 5000);
          }
        });
      }}
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
