import { eq } from "drizzle-orm";
import { workRequests } from "../../../../db/schema";
import { canEdit, requireApiUser } from "../../../auth";
import { notifyUsers, parseDate, priority } from "../../_lib/workflow";

export const runtime = "nodejs";
async function database() { const { getDb } = await import("../../../../db"); return getDb(); }

type RequestApprovalStep = { userId: string; userName?: string; positionName?: string; status?: string; comment?: string; decidedAt?: string | null };

function parseApprovalChain(value: string) {
  try {
    const parsed = JSON.parse(value || "[]") as unknown;
    if (!Array.isArray(parsed)) return [] as RequestApprovalStep[];
    return parsed.flatMap((entry): RequestApprovalStep[] => {
      if (typeof entry === "string") return [{ userId: entry, status: "PENDING" }];
      if (!entry || typeof entry !== "object" || typeof (entry as { userId?: unknown }).userId !== "string") return [];
      const item = entry as RequestApprovalStep;
      return [{ ...item, status: item.status === "APPROVED" || item.status === "REJECTED" ? item.status : "PENDING" }];
    });
  } catch {
    return [] as RequestApprovalStep[];
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const { id } = await context.params;
  const body = await request.json() as { status?: string; title?: string; details?: Record<string, unknown>; assignedToUserId?: string | null; priority?: string; dueAt?: string | null; approvalComment?: string };
  const db = await database();
  const [before] = await db.select().from(workRequests).where(eq(workRequests.id, id)).limit(1);
  if (!before) return Response.json({ error: "Request not found" }, { status: 404 });
  const chain = parseApprovalChain(before.approvalChainJson);
  const current = chain.find((step) => step.status === "PENDING");
  const isCurrentApprover = current?.userId === auth.id;
  const isDecision = body.status === "Approved" || body.status === "Rejected";
  if (before.requestedByUserId !== auth.id && before.assignedToUserId !== auth.id && !isCurrentApprover && !canEdit(auth)) return Response.json({ error: "You cannot update this request" }, { status: 403 });
  if (isDecision && !isCurrentApprover) return Response.json({ error: "Only the current organizational approver can approve this request." }, { status: 403 });
  const nextStatus = body.status === "In progress" || body.status === "Completed" || body.status === "Cancelled" || body.status === "Pending approval" ? body.status : before.status;
  const dueAt = body.dueAt === undefined ? before.dueAt : parseDate(body.dueAt);
  if (body.dueAt && !dueAt) return Response.json({ error: "Choose a valid request deadline" }, { status: 400 });
  let updatedChain = chain;
  let resolvedStatus = nextStatus;
  if (isDecision && current) {
    updatedChain = chain.map((step) => step.userId === current.userId && step.status === "PENDING" ? { ...step, status: body.status === "Approved" ? "APPROVED" : "REJECTED", comment: body.approvalComment?.trim() || "", decidedAt: new Date().toISOString() } : step);
    resolvedStatus = body.status === "Rejected" ? "Rejected" : updatedChain.some((step) => step.status === "PENDING") ? "Pending approval" : "Approved";
  }
  const [item] = await db.update(workRequests).set({
    ...(body.title !== undefined ? { title: body.title.trim() } : {}),
    ...(body.details !== undefined ? { detailsJson: JSON.stringify(body.details) } : {}),
    ...(body.assignedToUserId !== undefined ? { assignedToUserId: body.assignedToUserId?.trim() || null } : {}),
    ...(body.priority !== undefined ? { priority: priority(body.priority) } : {}),
    ...(body.dueAt !== undefined ? { dueAt } : {}),
    status: resolvedStatus,
    approvalChainJson: JSON.stringify(updatedChain),
    updatedAt: new Date().toISOString(),
  }).where(eq(workRequests.id, id)).returning();
  const nextApprover = updatedChain.find((step) => step.status === "PENDING");
  const notifyIds = [before.requestedByUserId, nextApprover?.userId].filter((value): value is string => Boolean(value));
  if (body.status === "Approved" && before.requestedByUserId) await notifyUsers(db, notifyIds, { type: resolvedStatus === "Approved" ? "request_approved" : "request_approval", title: resolvedStatus === "Approved" ? `${item.type} request approved` : `${item.type} request moved to the next approval`, message: resolvedStatus === "Approved" ? item.title : `${item.title} is waiting for ${nextApprover?.positionName || "the next authority"}.`, requestId: item.id, recordId: item.recordId ?? undefined });
  if (body.status === "Rejected" && before.requestedByUserId) await notifyUsers(db, notifyIds, { type: "request_rejected", title: `${item.type} request rejected`, message: body.approvalComment?.trim() || item.title, requestId: item.id, recordId: item.recordId ?? undefined });
  return Response.json({ request: { ...item, approvalChain: updatedChain, currentApproverUserId: nextApprover?.userId ?? null, currentApproverName: nextApprover?.userName ?? null, canApprove: nextApprover?.userId === auth.id } });
}
