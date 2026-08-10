import { eq } from "drizzle-orm";
import { records } from "../../../db/schema";
import { requireApiUser } from "../../auth";
import { ensureOrganization, performMasterApproval, refreshOverdueRecords } from "../_lib/hierarchy";

export const runtime = "nodejs";

async function database() { const { getDb } = await import("../../../db"); return getDb(); }

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;
    const body = await request.json() as { recordId?: string; recordIds?: string[]; reason?: string; comment?: string };
    const ids = [...new Set([...(body.recordId ? [body.recordId] : []), ...(body.recordIds ?? [])].map((id) => id.trim()).filter(Boolean))];
    if (!ids.length || !body.reason?.trim()) return Response.json({ error: "Choose at least one record and provide a Master Approval reason" }, { status: 400 });
    const db = await database();
    await ensureOrganization(db);
    await refreshOverdueRecords(db);
    const results = [];
    for (const id of ids) {
      const [record] = await db.select().from(records).where(eq(records.id, id)).limit(1);
      if (!record) return Response.json({ error: `Record ${id} was not found` }, { status: 404 });
      try {
        results.push(await performMasterApproval(db, auth, record, body.reason, body.comment ?? ""));
      } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : `Master Approval failed for ${id}`, recordId: id }, { status: 403 });
      }
    }
    return Response.json({ approved: results.map((result) => result.record), count: results.length });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Master Approval could not be completed" }, { status: 500 });
  }
}
