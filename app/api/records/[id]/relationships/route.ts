import { eq, or } from "drizzle-orm";
import { recordRelationships, records } from "../../../../../db/schema";
import { requireApiUser } from "../../../../auth";
import { canViewRecord } from "../../../_lib/workflow";

export const runtime = "nodejs";
async function database() { const { getDb } = await import("../../../../../db"); return getDb(); }

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const { id } = await context.params;
  const db = await database();
  const [record] = await db.select().from(records).where(eq(records.id, id)).limit(1);
  if (!record || !canViewRecord(auth, record)) return Response.json({ error: "Record not found" }, { status: 404 });
  const relationships = await db.select().from(recordRelationships).where(or(eq(recordRelationships.sourceRecordId, id), eq(recordRelationships.targetRecordId, id)));
  const relatedIds = [...new Set(relationships.flatMap((relationship) => [relationship.sourceRecordId, relationship.targetRecordId]).filter((recordId) => recordId !== id))];
  const related = relatedIds.length ? await db.select().from(records).where(or(...relatedIds.map((recordId) => eq(records.id, recordId)))) : [];
  return Response.json({ relationships, related });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const { id } = await context.params;
  const body = await request.json() as { targetRecordId?: string; relationshipType?: "Depends on" | "Supersedes" | "Related to" | "Evidence for" };
  if (!body.targetRecordId || !body.relationshipType || body.targetRecordId === id) return Response.json({ error: "Choose another record and a relationship type" }, { status: 400 });
  const db = await database();
  const [source, target] = await Promise.all([db.select().from(records).where(eq(records.id, id)).limit(1), db.select().from(records).where(eq(records.id, body.targetRecordId)).limit(1)]);
  if (!source[0] || !target[0] || !canViewRecord(auth, source[0]) || !canViewRecord(auth, target[0])) return Response.json({ error: "Both records must be visible to you" }, { status: 403 });
  const [relationship] = await db.insert(recordRelationships).values({ id: crypto.randomUUID(), sourceRecordId: id, targetRecordId: body.targetRecordId, relationshipType: body.relationshipType, createdByUserId: auth.id }).onConflictDoNothing().returning();
  return relationship ? Response.json({ relationship }, { status: 201 }) : Response.json({ error: "This relationship already exists" }, { status: 409 });
}
