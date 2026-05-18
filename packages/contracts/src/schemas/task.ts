import { z } from "zod";

export const TaskPrioritySchema = z.enum([
  "low",
  "medium",
  "high",
  "critical",
]);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

export const TaskStatusSchema = z.enum([
  "pending",
  "in_progress",
  "blocked",
  "done",
  "cancelled",
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  title: z.string().min(1),
  assignee_name: z.string().nullable(),
  priority: TaskPrioritySchema,
  technical_specifications: z.string().nullable(),
  status: TaskStatusSchema,
  source: z.enum(["manual", "dictation", "design"]).default("manual"),
  created_at: z.string().datetime(),
});
export type Task = z.infer<typeof TaskSchema>;

export const CreateTaskInputSchema = z.object({
  title: z.string().min(1),
  assignee_name: z.string().nullable().optional(),
  priority: TaskPrioritySchema.default("medium"),
  technical_specifications: z.string().nullable().optional(),
  source: z.enum(["manual", "dictation", "design"]).default("manual").optional(),
});
export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;

export const UpdateTaskStatusInputSchema = z.object({
  status: TaskStatusSchema,
});
export type UpdateTaskStatusInput = z.infer<typeof UpdateTaskStatusInputSchema>;
