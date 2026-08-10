import { desc, eq } from "drizzle-orm";
import { records, workRequests } from "../../../db/schema";
import { canEdit, localUsers, requireApiUser } from "../../auth";
import { canViewDepartment, canViewRecord, ensureOrganization, notifyUsers, parseDate, priority, registeredUserIds, resolveApprovalChain } from "../_lib/workflow";

export const runtime = "nodejs";
async function database() { const { getDb } = await import("../../../db"); return getDb(); }

type RequestApprovalStep = {
  userId: string;
  userName: string;
  positionCode: string;
  positionName: string;
  department?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  comment: string;
  decidedAt?: string | null;
};

function parseApprovalChain(value: string) {
  try {
    const parsed = JSON.parse(value || "[]") as unknown;
    if (!Array.isArray(parsed)) return [] as RequestApprovalStep[];
    return parsed.flatMap((entry): RequestApprovalStep[] => {
      if (typeof entry === "string") return [{ userId: entry, userName: entry, positionCode: "LEGACY", positionName: "Approval authority", status: "PENDING", comment: "" }];
      if (!entry || typeof entry !== "object") return [];
      const item = entry as Partial<RequestApprovalStep>;
      return typeof item.userId === "string" ? [{ userId: item.userId, userName: typeof item.userName === "string" ? item.userName : item.userId, positionCode: typeof item.positionCode === "string" ? item.positionCode : "", positionName: typeof item.positionName === "string" ? item.positionName : "Approval authority", department: item.department ?? null, status: item.status === "APPROVED" || item.status === "REJECTED" ? item.status : "PENDING", comment: typeof item.comment === "string" ? item.comment : "", decidedAt: item.decidedAt ?? null }] : [];
    });
  } catch {
    return [] as RequestApprovalStep[];
  }
}

export async function GET() {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const db = await database();
  const [rows, recordRows] = await Promise.all([db.select().from(workRequests).orderBy(desc(workRequests.updatedAt)), db.select().from(records)]);
  const recordMap = new Map(recordRows.map((record) => [record.id, record]));
  const visible = rows.filter((item) => item.requestedByUserId === auth.id || item.assignedToUserId === auth.id || canEdit(auth) || (item.recordId ? Boolean(recordMap.get(item.recordId) && canViewRecord(auth, recordMap.get(item.recordId)!)) : canViewDepartment(auth, item.department)));
  return Response.json({ requests: visible.map((item) => {
    const approvalChain = parseApprovalChain(item.approvalChainJson);
    const current = approvalChain.find((step) => step.status === "PENDING");
    return { ...item, approvalChain, currentApproverUserId: current?.userId ?? null, currentApproverName: current?.userName ?? null, canApprove: current?.userId === auth.id };
  }) });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const body = await request.json() as { projectId?: string; recordId?: string | null; type?: "Manufacturing" | "Purchase"; title?: string; department?: string; assignedToUserId?: string | null; priority?: string; dueAt?: string | null; details?: Record<string, unknown> };
  if (!body.projectId || !body.type || !body.title?.trim()) return Response.json({ error: "Project, request type and title are required" }, { status: 400 });
  const db = await database();
  await ensureOrganization(db);
  if (body.recordId) {
    const [record] = await db.select().from(records).where(eq(records.id, body.recordId)).limit(1);
    if (!record || !canViewRecord(auth, record)) return Response.json({ error: "The linked record cannot be accessed" }, { status: 403 });
  }
  const registered = await registeredUserIds(db);
  for (const user of localUsers()) registered.add(user.id);
  if (body.assignedToUserId && !registered.has(body.assignedToUserId)) return Response.json({ error: "Choose a registered team member for the assignee" }, { status: 400 });
  const dueAt = parseDate(body.dueAt);
  if (body.dueAt && !dueAt) return Response.json({ error: "Choose a valid request deadline" }, { status: 400 });
  const chain = body.department?.trim() ? await resolveApprovalChain(db, body.department.trim(), auth.id) : [];
  const approvalChain: RequestApprovalStep[] = chain.map((step) => ({ ...step, status: "PENDING", comment: "", decidedAt: null }));
  const [item] = await db.insert(workRequests).values({
    id: `${body.type === "Purchase" ? "PUR" : "MFG"}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    projectId: body.projectId,
    recordId: body.recordId?.trim() || null,
    type: body.type,
    title: body.title.trim(),
    department: body.department?.trim() || "",
    requestedByUserId: auth.id,
    assignedToUserId: body.assignedToUserId?.trim() || null,
    priority: priority(body.priority),
    dueAt,
    status: approvalChain.length ? "Pending approval" : "Draft",
    detailsJson: JSON.stringify(body.details ?? {}),
    approvalChainJson: JSON.stringify(approvalChain),
  }).returning();
  if (approvalChain.length) await notifyUsers(db, [approvalChain[0].userId], { type: "request_approval", title: `${item.type} request needs approval`, message: `${item.title} is waiting for ${approvalChain[0].positionName}.`, requestId: item.id, recordId: item.recordId ?? undefined });
  if (item.assignedToUserId) await notifyUsers(db, [item.assignedToUserId], { type: "request_assigned", title: `${item.type} request assigned`, message: item.title, requestId: item.id, recordId: item.recordId ?? undefined });
  return Response.json({ request: { ...item, approvalChain, currentApproverUserId: approvalChain[0]?.userId ?? null, currentApproverName: approvalChain[0]?.userName ?? null, canApprove: approvalChain[0]?.userId === auth.id } }, { status: 201 });
}
