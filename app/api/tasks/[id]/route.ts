import { eq } from "drizzle-orm";
import { taskComments, tasks } from "../../../../db/schema";
import { canEdit, requireApiUser } from "../../../auth";
import { notifyUsers, parseDate, priority } from "../../_lib/workflow";

export const runtime = "nodejs";
async function database() { const { getDb } = await import("../../../../db"); return getDb(); }

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const { id } = await context.params;
  const body = await request.json() as { title?: string; description?: string; assignedToUserId?: string | null; priority?: string; dueAt?: string | null; status?: string; comment?: string };
  const db = await database();
  const [before] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  if (!before) return Response.json({ error: "Task not found" }, { status: 404 });
  if (before.assignedToUserId !== auth.id && before.assignedByUserId !== auth.id && !canEdit(auth)) return Response.json({ error: "Only the assignee, task owner or team leader can update this task" }, { status: 403 });
  const dueAt = body.dueAt === undefined ? before.dueAt : parseDate(body.dueAt);
  if (body.dueAt && !dueAt) return Response.json({ error: "Choose a valid task deadline" }, { status: 400 });
  const status = body.status === "Done" || body.status === "In progress" || body.status === "Blocked" || body.status === "Cancelled" ? body.status : body.status === "To do" ? body.status : before.status;
  const [task] = await db.update(tasks).set({
    ...(body.title !== undefined ? { title: body.title.trim() } : {}),
    ...(body.description !== undefined ? { description: body.description.trim() } : {}),
    ...(body.assignedToUserId !== undefined ? { assignedToUserId: body.assignedToUserId?.trim() || null } : {}),
    ...(body.priority !== undefined ? { priority: priority(body.priority) } : {}),
    ...(body.dueAt !== undefined ? { dueAt } : {}),
    ...(body.status !== undefined ? { status, completedAt: status === "Done" ? new Date().toISOString() : null } : {}),
    updatedAt: new Date().toISOString(),
  }).where(eq(tasks.id, id)).returning();
  if (body.comment?.trim()) await db.insert(taskComments).values({ id: crypto.randomUUID(), taskId: id, authorUserId: auth.id, comment: body.comment.trim() });
  if (body.assignedToUserId && body.assignedToUserId !== before.assignedToUserId) await notifyUsers(db, [body.assignedToUserId], { type: "task_assigned", title: "Task assigned to you", message: task.title, taskId: task.id, recordId: task.recordId ?? undefined });
  return Response.json({ task });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const { id } = await context.params;
  const db = await database();
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  if (!task) return Response.json({ error: "Task not found" }, { status: 404 });
  if (task.assignedToUserId !== auth.id && task.assignedByUserId !== auth.id && !canEdit(auth)) return Response.json({ error: "Task not found" }, { status: 404 });
  const comments = await db.select().from(taskComments).where(eq(taskComments.taskId, id)).orderBy(taskComments.createdAt);
  return Response.json({ task, comments });
}
