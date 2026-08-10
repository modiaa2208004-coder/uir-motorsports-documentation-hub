import { desc } from "drizzle-orm";
import { evidence, recordEvents, recordReviews, recordVersions, records } from "../../../db/schema";
import type { RecordStatus } from "../../../db/schema";
import { requireApiUser, userOfficialRoles } from "../../auth";
import { canViewRecord, ensureOrganization, parseDate, priority, refreshOverdueRecords, resolveApprovalChain } from "../_lib/workflow";

export const runtime = "nodejs";

async function database() { const { getDb } = await import("../../../db"); return getDb(); }

function parseRecordStatus(value: unknown): RecordStatus | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase() === "in review" ? "In review" : value.trim();
  return ["Draft", "Submitted", "In review", "Returned", "Approved", "Rejected", "Closed", "Archived", "Cancelled", "Overdue"].includes(normalized) ? normalized as RecordStatus : null;
}

export async function GET() {
  try {
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;
    const db = await database();
    await ensureOrganization(db);
    await refreshOverdueRecords(db);
    const [rows, reviewRows, eventRows, evidenceRows] = await Promise.all([
      db.select().from(records).orderBy(desc(records.updatedAt)).limit(200),
      db.select().from(recordReviews).orderBy(desc(recordReviews.createdAt)),
      db.select().from(recordEvents).orderBy(desc(recordEvents.createdAt)),
      db.select().from(evidence),
    ]);
    const reviewsByRecord = new Map<string, typeof reviewRows>();
    const eventsByRecord = new Map<string, typeof eventRows>();
    const evidenceByRecord = new Map<string, typeof evidenceRows>();
    for (const review of reviewRows) reviewsByRecord.set(review.recordId, [...(reviewsByRecord.get(review.recordId) ?? []), review]);
    for (const event of eventRows) eventsByRecord.set(event.recordId, [...(eventsByRecord.get(event.recordId) ?? []), event]);
    for (const item of evidenceRows) if (!item.deletedAt) evidenceByRecord.set(item.recordId, [...(evidenceByRecord.get(item.recordId) ?? []), item]);
    return Response.json({ records: rows.filter((record) => canViewRecord(auth, record)).map((record) => ({ ...record, reviewHistory: reviewsByRecord.get(record.id) ?? [], eventHistory: eventsByRecord.get(record.id) ?? [], evidenceHistory: evidenceByRecord.get(record.id) ?? [] })) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load records" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;
    const payload = await request.json() as {
      projectId?: string;
      title?: string;
      type?: string;
      system?: string;
      owner?: string;
      submittedRole?: string;
      department?: string;
      subprojectId?: string | null;
      componentId?: string | null;
      description?: string;
      priority?: string;
      dueAt?: string | null;
      responsibleUserIds?: string[];
      supervisorUserId?: string | null;
      competitionRelated?: boolean;
      problem?: string;
      details?: Record<string, string>;
      status?: string;
    };
    const projectId = payload.projectId?.trim() || "HOPE-2027";
    const title = payload.title?.trim() ?? "";
    const type = payload.type?.trim() ?? "";
    const system = payload.system?.trim() ?? "";
    const db = await database();
    await ensureOrganization(db);
    const submittedRole = payload.submittedRole?.trim() || userOfficialRoles(auth)[0] || "Member";
    const status = payload.status === undefined ? "Draft" : parseRecordStatus(payload.status);
    if (!title || !type || !system) return Response.json({ error: "title, type and system are required" }, { status: 400 });
    if (payload.submittedRole && !userOfficialRoles(auth).includes(payload.submittedRole as never)) return Response.json({ error: "Choose one of your assigned roles for this submission" }, { status: 403 });
    if (!status || status !== "Draft") return Response.json({ error: "New records must start as Draft and be submitted through the review workflow." }, { status: 400 });

    const dueAt = parseDate(payload.dueAt);
    if (payload.dueAt && !dueAt) return Response.json({ error: "Choose a valid document deadline" }, { status: 400 });
    const responsibleUserIds = [...new Set((payload.responsibleUserIds ?? []).map((id) => id.trim()).filter(Boolean))];
    const chain = await resolveApprovalChain(db, payload.department?.trim() ?? "", auth.id);
    const reviewerUserIds = chain.map((item) => item.userId);
    const recordId = `REC-2027-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const [record] = await db.insert(records).values({
      id: recordId,
      projectId,
      title,
      type,
      system,
      problem: payload.problem?.trim() ?? "",
      owner: payload.owner?.trim() || auth.displayName,
      ownerUserId: auth.id,
      submittedRole,
      department: payload.department?.trim() ?? "",
      subprojectId: payload.subprojectId?.trim() || null,
      componentId: payload.componentId?.trim() || null,
      description: payload.description?.trim() ?? "",
      priority: priority(payload.priority),
      dueAt,
      responsibleUserIds: JSON.stringify(responsibleUserIds),
      supervisorUserId: null,
      approverUserIds: JSON.stringify(reviewerUserIds),
      competitionRelated: payload.competitionRelated ? 1 : 0,
      reviewer: chain.map((item) => `${item.userName} · ${item.positionName}`).join(", ") || "No organizational approver assigned",
      reviewerUserId: reviewerUserIds[0] || null,
      reviewerUserIds: JSON.stringify(reviewerUserIds),
      approvalChainJson: JSON.stringify(chain),
      status: "Draft",
      detailsJson: JSON.stringify(payload.details ?? {}),
      completeness: calculateCompleteness(payload),
    }).returning();
    await db.insert(recordEvents).values({ id: crypto.randomUUID(), recordId: record.id, projectId: record.projectId, actorUserId: auth.id, type: "record_created", payloadJson: JSON.stringify({ actorName: auth.displayName, title: record.title, status: record.status, automaticApprovalChain: chain }) });
    await db.insert(recordVersions).values({ id: crypto.randomUUID(), recordId: record.id, projectId: record.projectId, revision: record.revision, status: record.status, snapshotJson: JSON.stringify(record), changeSummary: "Initial document version", createdByUserId: auth.id });
    return Response.json({ record, approvalChain: chain }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save record" }, { status: 500 });
  }
}

function calculateCompleteness(payload: { title?: string; type?: string; system?: string; problem?: string; details?: Record<string, string> }) {
  const values = [payload.title, payload.type, payload.system, payload.problem, ...Object.values(payload.details ?? {})];
  const completed = values.filter((value) => value?.trim()).length;
  return Math.max(10, Math.min(95, Math.round((completed / Math.max(values.length, 1)) * 100)));
}
