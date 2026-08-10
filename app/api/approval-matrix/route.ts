import { asc, eq } from "drizzle-orm";
import { approvalRules } from "../../../db/schema";
import { canEdit, requireApiUser } from "../../auth";

export const runtime = "nodejs";
async function database() { const { getDb } = await import("../../../db"); return getDb(); }

export async function GET() {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const rules = await (await database()).select().from(approvalRules).orderBy(asc(approvalRules.name));
  return Response.json({ rules });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  if (!canEdit(auth)) return Response.json({ error: "Only team leaders can configure approval rules" }, { status: 403 });
  const body = await request.json() as { name?: string; documentType?: string; department?: string; requiredRole?: string; approvalDepth?: number; parallel?: boolean };
  if (!body.name?.trim() || !body.requiredRole?.trim()) return Response.json({ error: "Rule name and required role are required" }, { status: 400 });
  const [rule] = await (await database()).insert(approvalRules).values({ id: crypto.randomUUID(), name: body.name.trim(), documentType: body.documentType?.trim() || "*", department: body.department?.trim() || "*", requiredRole: body.requiredRole.trim(), approvalDepth: Math.max(1, Math.round(body.approvalDepth ?? 1)), parallel: body.parallel === false ? 0 : 1, active: 1, createdByUserId: auth.id }).returning();
  return Response.json({ rule }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  if (!canEdit(auth)) return Response.json({ error: "Only team leaders can configure approval rules" }, { status: 403 });
  const body = await request.json() as { id?: string; active?: boolean; approvalDepth?: number; parallel?: boolean };
  if (!body.id) return Response.json({ error: "Rule id is required" }, { status: 400 });
  const [rule] = await (await database()).update(approvalRules).set({ ...(body.active !== undefined ? { active: body.active ? 1 : 0 } : {}), ...(body.approvalDepth !== undefined ? { approvalDepth: Math.max(1, Math.round(body.approvalDepth)) } : {}), ...(body.parallel !== undefined ? { parallel: body.parallel ? 1 : 0 } : {}), updatedAt: new Date().toISOString() }).where(eq(approvalRules.id, body.id)).returning();
  return rule ? Response.json({ rule }) : Response.json({ error: "Rule not found" }, { status: 404 });
}
