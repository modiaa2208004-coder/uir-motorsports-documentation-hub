import { eq, sql } from "drizzle-orm";
import { approvalSteps, approvalWorkflows, evidence, recordEvents, recordReviews, recordVersions, records } from "../../../../db/schema";
import type { RecordStatus } from "../../../../db/schema";
import { canEditRecord, isOfficialRole, requireApiUser, userOfficialRoles } from "../../../auth";
import { canMasterApprove, canViewRecord, ensureOrganization, notifyUsers, parseDate, parseIds, priority, resolveApprovalChain } from "../../_lib/workflow";

export const runtime = "nodejs";

async function database() { const { getDb } = await import("../../../../db"); return getDb(); }

function parseStatus(value: unknown): RecordStatus | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase() === "in review" ? "In review" : value.trim();
  return ["Draft", "Submitted", "In review", "Returned", "Approved", "Rejected", "Closed", "Archived", "Cancelled", "Overdue"].includes(normalized) ? normalized as RecordStatus : null;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const { id } = await context.params;
  const db = await database();
  const [record] = await db.select().from(records).where(eq(records.id, id)).limit(1);
  if (!record) return Response.json({ error: "Record not found" }, { status: 404 });
  if (!canViewRecord(auth, record)) return Response.json({ error: "You do not have access to this record" }, { status: 403 });
  const [reviews, events, evidenceRows, versions, workflow, steps] = await Promise.all([
    db.select().from(recordReviews).where(eq(recordReviews.recordId, id)).orderBy(sql`${recordReviews.createdAt} DESC`),
    db.select().from(recordEvents).where(eq(recordEvents.recordId, id)).orderBy(sql`${recordEvents.createdAt} DESC`),
    db.select().from(evidence).where(eq(evidence.recordId, id)).orderBy(sql`${evidence.createdAt} ASC`),
    db.select().from(recordVersions).where(eq(recordVersions.recordId, id)).orderBy(sql`${recordVersions.revision} DESC`),
    db.select().from(approvalWorkflows).where(eq(approvalWorkflows.recordId, id)).limit(1),
    db.select().from(approvalSteps).where(eq(approvalSteps.workflowId, (await db.select().from(approvalWorkflows).where(eq(approvalWorkflows.recordId, id)).limit(1))[0]?.id ?? "")).orderBy(approvalSteps.stepOrder),
  ]);
  return Response.json({ record, reviews, events, versions, evidence: evidenceRows.filter((item) => !item.deletedAt), workflow: workflow[0] ?? null, steps, permissions: { canMasterApprove: await canMasterApprove(db, auth, record) } });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;
    const { id } = await context.params;
    const payload = await request.json() as {
      title?: string;
      system?: string;
      submittedRole?: string;
      department?: string;
      subprojectId?: string | null;
      componentId?: string | null;
      description?: string;
      priority?: string;
      dueAt?: string | null;
      responsibleUserIds?: string[];
      competitionRelated?: boolean;
      status?: string;
      problem?: string;
      details?: Record<string, string>;
    };
    const db = await database();
    await ensureOrganization(db);
    const [before] = await db.select().from(records).where(eq(records.id, id)).limit(1);
    if (!before) return Response.json({ error: "Record not found" }, { status: 404 });
    if (!canViewRecord(auth, before)) return Response.json({ error: "You do not have access to this record" }, { status: 403 });
    if (["Approved", "Closed", "Archived"].includes(before.status)) return Response.json({ error: "This record is sealed because approval is complete. Create a new record for further changes." }, { status: 409 });
    const nextStatus = payload.status === undefined ? null : parseStatus(payload.status);
    if (payload.status !== undefined && !nextStatus) return Response.json({ error: "Invalid record status" }, { status: 400 });
    if (nextStatus === "Approved" || (nextStatus && !["Draft", "In review"].includes(nextStatus) && nextStatus !== before.status)) return Response.json({ error: "This status is controlled by the review workflow." }, { status: 400 });
    if (nextStatus === "Returned") return Response.json({ error: "Returned status is set by a reviewer. Submit the record again after making the requested changes." }, { status: 400 });
    if (!canEditRecord(auth, before.ownerUserId, null) && auth.id !== before.ownerUserId) return Response.json({ error: "Only the document creator or an organizational leader can edit this record." }, { status: 403 });
    const submittedRole = payload.submittedRole?.trim();
    if (submittedRole !== undefined && (!submittedRole || (!isOfficialRole(submittedRole) && submittedRole !== "Member") || (isOfficialRole(submittedRole) && !userOfficialRoles(auth).includes(submittedRole)))) return Response.json({ error: "Choose one of your assigned roles for this submission" }, { status: 403 });
    if (submittedRole && before.status === "In review") return Response.json({ error: "The working role cannot change while a review round is active." }, { status: 409 });
    const dueAt = payload.dueAt === undefined ? before.dueAt : parseDate(payload.dueAt);
    if (payload.dueAt && !dueAt) return Response.json({ error: "Choose a valid document deadline" }, { status: 400 });
    const submitting = nextStatus === "In review" && before.status !== "In review";
    const department = payload.department === undefined ? before.department : payload.department.trim();
    const chain = submitting ? await resolveApprovalChain(db, department, before.ownerUserId) : null;
    if (submitting && !chain?.length) return Response.json({ error: "The automatic hierarchy could not find an approver for this department." }, { status: 409 });
    const detailValues = Object.values(payload.details ?? {});
    const values = [payload.title, payload.system, payload.problem, ...detailValues];
    const completeness = Math.max(10, Math.min(100, Math.round((values.filter((value) => value?.trim()).length / Math.max(values.length, 1)) * 100)));
    const contentChanged = Object.keys(payload).some((key) => ["title", "system", "problem", "details", "description", "department", "subprojectId", "componentId", "responsibleUserIds", "submittedRole"].includes(key));
    const nextRevision = before.revision + (contentChanged ? 1 : 0);
    const nextReviewRound = submitting ? before.reviewRound + 1 : before.reviewRound;
    const reviewerIds = chain?.map((item) => item.userId) ?? parseIds(before.reviewerUserIds);
    const reviewerText = chain?.map((item) => `${item.userName} · ${item.positionName}`).join(", ") ?? before.reviewer;
    const [record] = await db.update(records).set({
      ...(payload.title !== undefined ? { title: payload.title.trim() } : {}),
      ...(payload.system !== undefined ? { system: payload.system.trim() } : {}),
      ...(payload.department !== undefined ? { department } : {}),
      ...(payload.subprojectId !== undefined ? { subprojectId: payload.subprojectId?.trim() || null } : {}),
      ...(payload.componentId !== undefined ? { componentId: payload.componentId?.trim() || null } : {}),
      ...(payload.description !== undefined ? { description: payload.description.trim() } : {}),
      ...(payload.priority !== undefined ? { priority: priority(payload.priority) } : {}),
      ...(payload.dueAt !== undefined ? { dueAt } : {}),
      ...(payload.responsibleUserIds !== undefined ? { responsibleUserIds: JSON.stringify([...new Set(payload.responsibleUserIds.map((item) => item.trim()).filter(Boolean))]) } : {}),
      ...(payload.competitionRelated !== undefined ? { competitionRelated: payload.competitionRelated ? 1 : 0 } : {}),
      ...(submittedRole !== undefined ? { submittedRole } : {}),
      ...(payload.problem !== undefined ? { problem: payload.problem.trim() } : {}),
      ...(payload.details !== undefined ? { detailsJson: JSON.stringify(payload.details), completeness } : {}),
      ...(nextRevision !== before.revision ? { revision: nextRevision } : {}),
      ...(submitting ? { status: "In review" as const, reviewRound: nextReviewRound, reviewSubmittedAt: new Date().toISOString(), reviewDueAt: before.reviewDueAt || dueAt, reviewerUserIds: JSON.stringify(reviewerIds), reviewerUserId: reviewerIds[0] || null, reviewer: reviewerText, approverUserIds: JSON.stringify(reviewerIds), approvalChainJson: JSON.stringify(chain) } : {}),
      updatedAt: sql`CURRENT_TIMESTAMP`,
    }).where(eq(records.id, id)).returning();

    if (submitting && chain) {
      const [existing] = await db.select().from(approvalWorkflows).where(eq(approvalWorkflows.recordId, id)).limit(1);
      if (existing) {
        await db.update(approvalWorkflows).set({ requiredApprovals: chain.length, completedApprovals: 0, status: "Open", updatedAt: new Date().toISOString() }).where(eq(approvalWorkflows.id, existing.id));
        await db.delete(approvalSteps).where(eq(approvalSteps.workflowId, existing.id));
        await db.insert(approvalSteps).values(chain.map((item, index) => ({ id: crypto.randomUUID(), workflowId: existing.id, reviewerUserId: item.userId, stepOrder: index + 1, status: "Pending" })));
      } else {
        const [workflow] = await db.insert(approvalWorkflows).values({ id: crypto.randomUUID(), recordId: id, requiredApprovals: chain.length, completedApprovals: 0, status: "Open" }).returning();
        await db.insert(approvalSteps).values(chain.map((item, index) => ({ id: crypto.randomUUID(), workflowId: workflow.id, reviewerUserId: item.userId, stepOrder: index + 1, status: "Pending" })));
      }
      await db.insert(recordEvents).values({ id: crypto.randomUUID(), recordId: id, projectId: record.projectId, actorUserId: auth.id, type: "review_assigned", payloadJson: JSON.stringify({ actorName: auth.displayName, automaticApprovalChain: chain, submittedAt: record.reviewSubmittedAt }) });
      await notifyUsers(db, reviewerIds, { type: "review_assignment", title: "Document submitted for review", message: `${record.title} is waiting for the automatic organizational approval chain.`, recordId: record.id });
    }
    await db.insert(recordEvents).values({ id: crypto.randomUUID(), recordId: record.id, projectId: record.projectId, actorUserId: auth.id, type: nextStatus && nextStatus !== before.status ? "record_status_changed" : "record_updated", payloadJson: JSON.stringify({ actorName: auth.displayName, changes: payload, before: auditRecordSnapshot(before), after: auditRecordSnapshot(record) }) });
    if (nextRevision !== before.revision) await db.insert(recordVersions).values({ id: crypto.randomUUID(), recordId: record.id, projectId: record.projectId, revision: record.revision, status: record.status, snapshotJson: JSON.stringify(record), changeSummary: submitting ? "Submitted revision for automatic review" : "Document updated", createdByUserId: auth.id });
    const [reviews, events, versions] = await Promise.all([db.select().from(recordReviews).where(eq(recordReviews.recordId, id)).orderBy(sql`${recordReviews.createdAt} DESC`), db.select().from(recordEvents).where(eq(recordEvents.recordId, id)).orderBy(sql`${recordEvents.createdAt} DESC`), db.select().from(recordVersions).where(eq(recordVersions.recordId, id)).orderBy(sql`${recordVersions.revision} DESC`)]);
    return Response.json({ record, reviews, events, versions, approvalChain: chain });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update record" }, { status: 500 });
  }
}

function auditRecordSnapshot(record: typeof records.$inferSelect) {
  let details: Record<string, string> = {};
  try { details = JSON.parse(record.detailsJson || "{}"); } catch { details = {}; }
  return { id: record.id, projectId: record.projectId, title: record.title, type: record.type, system: record.system, owner: record.owner, ownerUserId: record.ownerUserId, submittedRole: record.submittedRole, department: record.department, subprojectId: record.subprojectId, componentId: record.componentId, description: record.description, priority: record.priority, dueAt: record.dueAt, responsibleUserIds: parseIds(record.responsibleUserIds), competitionRelated: Boolean(record.competitionRelated), revision: record.revision, reviewer: record.reviewer, reviewerUserId: record.reviewerUserId, reviewerUserIds: parseIds(record.reviewerUserIds), status: record.status, problem: record.problem, details, completeness: record.completeness, reviewRound: record.reviewRound, reviewDueAt: record.reviewDueAt, updatedAt: record.updatedAt };
}
