import { and, desc, eq } from "drizzle-orm";
import { approvalSteps, approvalWorkflows, recordEvents, recordReviews, records, tasks } from "../../../db/schema";
import { requireApiUser } from "../../auth";
import { canReviewRecord, canViewRecord, ensureOrganization, getNextApprovalStep, notifyUsers, refreshOverdueRecords, resolveApprovalChainForRecord } from "../_lib/workflow";

async function database() { const { getDb } = await import("../../../db"); return getDb(); }

async function ensureWorkflow(db: Awaited<ReturnType<typeof database>>, record: typeof records.$inferSelect) {
  let [workflow] = await db.select().from(approvalWorkflows).where(eq(approvalWorkflows.recordId, record.id)).limit(1);
  const chain = await resolveApprovalChainForRecord(db, record);
  if (!workflow) {
    [workflow] = await db.insert(approvalWorkflows).values({ id: crypto.randomUUID(), recordId: record.id, requiredApprovals: chain.length, completedApprovals: 0, status: "Open" }).returning();
    if (chain.length) await db.insert(approvalSteps).values(chain.map((item, index) => ({ id: crypto.randomUUID(), workflowId: workflow.id, reviewerUserId: item.userId, stepOrder: index + 1, status: "Pending" })));
  }
  return { workflow, chain };
}

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;
    const db = await database();
    await ensureOrganization(db);
    await refreshOverdueRecords(db);
    const recordId = new URL(request.url).searchParams.get("recordId");
    if (recordId) {
      const [record] = await db.select().from(records).where(eq(records.id, recordId)).limit(1);
      if (!record || !canViewRecord(auth, record)) return Response.json({ error: "You do not have access to this review history" }, { status: 403 });
      return Response.json({ reviews: await db.select().from(recordReviews).where(eq(recordReviews.recordId, recordId)).orderBy(desc(recordReviews.createdAt)) });
    }
    const allRecords = await db.select().from(records);
    const assignedRecordIds: string[] = [];
    for (const record of allRecords) if (await canReviewRecord(db, auth, record)) assignedRecordIds.push(record.id);
    if (!assignedRecordIds.length) return Response.json({ reviews: [] });
    const reviews = await db.select().from(recordReviews).orderBy(desc(recordReviews.createdAt));
    return Response.json({ reviews: reviews.filter((review) => assignedRecordIds.includes(review.recordId)) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load reviews" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;
    const body = await request.json() as {
      recordId?: string;
      requestedChanges?: string;
      comment?: string;
      proposedTitle?: string;
      proposedSystem?: string;
      proposedProblem?: string;
      proposedDetails?: Record<string, string>;
      dueAt?: string | null;
      status?: "Open" | "Changes requested" | "Accepted" | "Rejected";
    };
    if (!body.recordId || (body.status !== "Accepted" && !body.requestedChanges?.trim() && !body.comment?.trim())) return Response.json({ error: "A review comment or requested change is required" }, { status: 400 });
    const db = await database();
    await refreshOverdueRecords(db);
    const [record] = await db.select().from(records).where(eq(records.id, body.recordId)).limit(1);
    if (!record) return Response.json({ error: "Record not found" }, { status: 404 });
    if (["Approved", "Closed", "Archived", "Cancelled"].includes(record.status)) return Response.json({ error: "This record is sealed and cannot receive another review." }, { status: 409 });
    if (!["In review", "Overdue"].includes(record.status)) return Response.json({ error: "The owner must submit this record before it can receive a review decision." }, { status: 409 });
    if (!(await canReviewRecord(db, auth, record))) return Response.json({ error: "Only the current reviewer in the automatic approval chain can submit this review." }, { status: 403 });
    const { workflow } = await ensureWorkflow(db, record);
    const currentStep = await getNextApprovalStep(db, record.id);
    if (!currentStep || currentStep.reviewerUserId !== auth.id) return Response.json({ error: "This review is waiting for another organizational position." }, { status: 409 });
    const reviewStatus = body.status === "Accepted" ? "Accepted" : body.status === "Rejected" ? "Rejected" : "Changes requested";
    const reviewRound = record.reviewRound || 1;
    const [previousDecision] = await db.select({ id: recordReviews.id }).from(recordReviews).where(and(eq(recordReviews.recordId, record.id), eq(recordReviews.reviewRound, reviewRound), eq(recordReviews.reviewerUserId, auth.id))).limit(1);
    if (previousDecision) return Response.json({ error: "You have already submitted a decision for this review round." }, { status: 409 });
    let previousDetails: Record<string, string> = {};
    try { previousDetails = JSON.parse(record.detailsJson || "{}"); } catch { previousDetails = {}; }
    const [review] = await db.insert(recordReviews).values({ id: crypto.randomUUID(), recordId: record.id, projectId: record.projectId, reviewerUserId: auth.id, reviewerName: auth.displayName, requestedChanges: body.requestedChanges?.trim() || "", comment: body.comment?.trim() || "", proposedTitle: body.proposedTitle?.trim() || record.title, proposedSystem: body.proposedSystem?.trim() || record.system, proposedProblem: body.proposedProblem?.trim() || record.problem, proposedDetailsJson: JSON.stringify(body.proposedDetails ?? previousDetails), reviewRound, dueAt: body.dueAt || null, status: reviewStatus }).returning();
    const stepStatus = reviewStatus === "Accepted" ? "APPROVED" : reviewStatus === "Rejected" ? "REJECTED" : "CHANGES_REQUESTED";
    await db.update(approvalSteps).set({ status: stepStatus, comment: `${review.requestedChanges}${review.comment ? `\n${review.comment}` : ""}`.trim(), decidedAt: new Date().toISOString() }).where(eq(approvalSteps.id, currentStep.id));
    const remainingStep = await getNextApprovalStep(db, record.id);
    const nextStatus = reviewStatus === "Changes requested" ? "Returned" : reviewStatus === "Rejected" ? "Rejected" : remainingStep ? "In review" : "Approved";
    const approvedSteps = await db.select().from(approvalSteps).where(and(eq(approvalSteps.workflowId, workflow.id), eq(approvalSteps.status, "APPROVED")));
    const nextApprover = remainingStep ? (await resolveApprovalChainForRecord(db, record)).find((item) => item.userId === remainingStep.reviewerUserId) : null;
    const [updatedRecord] = await db.update(records).set({ status: nextStatus, reviewDueAt: reviewStatus === "Changes requested" ? body.dueAt || null : remainingStep ? record.reviewDueAt : null, reviewerUserId: nextStatus === "Returned" ? auth.id : remainingStep?.reviewerUserId || null, reviewerUserIds: JSON.stringify((await db.select().from(approvalSteps).where(eq(approvalSteps.workflowId, workflow.id))).map((step) => step.reviewerUserId)), reviewer: nextStatus === "Returned" ? `${auth.displayName} · Changes requested` : nextApprover ? `${nextApprover.userName} · ${nextApprover.positionName}` : record.reviewer, updatedAt: new Date().toISOString() }).where(eq(records.id, record.id)).returning();
    await db.update(approvalWorkflows).set({ completedApprovals: approvedSteps.length, status: nextStatus === "Approved" ? "Approved" : nextStatus === "Returned" ? "Changes requested" : nextStatus === "Rejected" ? "Rejected" : "Open", updatedAt: new Date().toISOString() }).where(eq(approvalWorkflows.id, workflow.id));
    await db.insert(recordEvents).values({ id: crypto.randomUUID(), recordId: record.id, projectId: record.projectId, actorUserId: auth.id, type: "review_submitted", payloadJson: JSON.stringify({ actorName: auth.displayName, reviewId: review.id, reviewStatus, recordStatus: nextStatus, reviewRound, beforeRecordStatus: record.status, afterRecordStatus: nextStatus, requestedChanges: review.requestedChanges, comment: review.comment, automaticNextReviewer: remainingStep?.reviewerUserId ?? null }) });
    if (nextStatus === "Returned") {
      await db.insert(tasks).values({ id: `TASK-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, projectId: record.projectId, recordId: record.id, title: `Update ${record.title} after review`, description: [review.requestedChanges, review.comment].filter(Boolean).join("\n\n") || "Review changes requested.", department: record.department, assignedToUserId: record.ownerUserId, assignedByUserId: auth.id, priority: record.priority, dueAt: body.dueAt || null, status: "To do" });
    }
    await notifyUsers(db, [...(record.ownerUserId ? [record.ownerUserId] : []), ...(remainingStep ? [remainingStep.reviewerUserId] : [])], { type: nextStatus === "Approved" ? "record_approved" : nextStatus === "Returned" ? "record_returned" : "review_progressed", title: nextStatus === "Approved" ? "Document approved" : nextStatus === "Returned" ? "Changes requested" : "Next review is ready", message: nextStatus === "Approved" ? `${record.title} passed the organizational approval chain.` : nextStatus === "Returned" ? `${record.title} was returned with requested changes.` : `${record.title} is now waiting for your review.`, recordId: record.id });
    return Response.json({ review, record: updatedRecord, recordStatus: nextStatus, approvalsReceived: approvedSteps.length, approvalsRequired: workflow.requiredApprovals });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save review" }, { status: 500 });
  }
}
