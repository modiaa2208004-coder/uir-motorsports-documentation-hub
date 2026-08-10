import { desc, eq } from "drizzle-orm";
import { records, tasks } from "../../../db/schema";
import { localUsers, requireApiUser } from "../../auth";
import { canViewDepartment, canViewRecord, getManagementChain, notifyUsers, parseDate, registeredUserIds } from "../_lib/workflow";

export const runtime = "nodejs";
async function database() { const { getDb } = await import("../../../db"); return getDb(); }

export async function GET() {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const db = await database();
  const [rows, recordRows] = await Promise.all([db.select().from(tasks).orderBy(desc(tasks.updatedAt)), db.select().from(records)]);
  const recordMap = new Map(recordRows.map((record) => [record.id, record]));
  const visible = rows.filter((task) => {
    if (task.assignedToUserId === auth.id || task.assignedByUserId === auth.id) return true;
    const record = task.recordId ? recordMap.get(task.recordId) : undefined;
    return record ? canViewRecord(auth, record) : canViewDepartment(auth, task.department);
  });
  return Response.json({ tasks: visible });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const body = await request.json() as { projectId?: string; recordId?: string | null; title?: string; description?: string; department?: string; assignedToUserId?: string | null; priority?: string; dueAt?: string | null; status?: string };
  if (!body.projectId || !body.title?.trim()) return Response.json({ error: "Project and task title are required" }, { status: 400 });
  const db = await database();
  if (body.recordId) {
    const [record] = await db.select().from(records).where(eq(records.id, body.recordId)).limit(1);
    if (!record || !canViewRecord(auth, record)) return Response.json({ error: "The linked record cannot be accessed" }, { status: 403 });
  }
  if (body.assignedToUserId) {
    const ids = await registeredUserIds(db);
    for (const user of localUsers()) ids.add(user.id);
    if (!ids.has(body.assignedToUserId)) return Response.json({ error: "Choose a registered team member" }, { status: 400 });
  }
  const dueAt = parseDate(body.dueAt);
  if (body.dueAt && !dueAt) return Response.json({ error: "Choose a valid task deadline" }, { status: 400 });
  const [task] = await db.insert(tasks).values({
    id: `TASK-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    projectId: body.projectId,
    recordId: body.recordId?.trim() || null,
    title: body.title.trim(),
    description: body.description?.trim() || "",
    department: body.department?.trim() || "",
    assignedToUserId: body.assignedToUserId?.trim() || null,
    assignedByUserId: auth.id,
    priority: body.priority === "Low" || body.priority === "High" || body.priority === "Critical" ? body.priority : "Normal",
    dueAt,
    status: body.status === "In progress" || body.status === "Blocked" ? body.status : "To do",
  }).returning();
  const chain = task.department ? await getManagementChain(db, { ...auth, departments: [task.department] }) : [];
  if (task.assignedToUserId) await notifyUsers(db, [task.assignedToUserId, ...chain.map((item) => item.userId ?? "")], { type: "task_assigned", title: "New task assigned", message: task.title, taskId: task.id, recordId: task.recordId ?? undefined });
  return Response.json({ task }, { status: 201 });
}
