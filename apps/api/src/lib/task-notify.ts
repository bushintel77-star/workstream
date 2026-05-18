import type { Store, Task } from "@construct/db";
import { send } from "./notify";

/**
 * Fire-and-forget WhatsApp notification when a task is assigned to a named
 * crew member who has a phone number on file. Silent no-op if the assignee
 * doesn't resolve to a crew member or has no phone.
 */
export async function notifyTaskAssignment(
  store: Store,
  ownerId: string,
  task: Task,
): Promise<void> {
  if (!task.assignee_name) return;
  try {
    const crew = await store.listCrew(ownerId);
    const member = crew.find(
      (c) =>
        c.active &&
        c.name.toLowerCase() === task.assignee_name!.toLowerCase(),
    );
    if (!member?.phone) return;
    const priority = task.priority.toUpperCase();
    const body =
      `[${priority}] ${task.title}` +
      (task.technical_specifications
        ? `\n${task.technical_specifications}`
        : "") +
      `\n— Construct`;
    await send({ channel: "whatsapp", to: member.phone, body });
  } catch (err) {
    console.warn("[notify] task assignment notification failed:", err);
  }
}
