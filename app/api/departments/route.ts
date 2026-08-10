import { departments } from "../../../db/schema";
import { requireApiUser, requireEditor } from "../../auth";
import { ensureOrganization } from "../_lib/hierarchy";

export const runtime = "nodejs";

async function database() { const { getDb } = await import("../../../db"); return getDb(); }

export async function GET() {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const db = await database();
  await ensureOrganization(db);
  const rows = await db.select().from(departments);
  return Response.json({ departments: rows.sort((a, b) => a.name.localeCompare(b.name)) });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const denied = requireEditor(auth);
  if (denied) return denied;
  const body = await request.json() as { name?: string; parentDepartmentId?: string | null; parentRole?: string; description?: string };
  const name = body.name?.trim();
  if (!name) return Response.json({ error: "Department name is required" }, { status: 400 });
  const db = await database();
  const [department] = await db.insert(departments).values({ id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${crypto.randomUUID().slice(0, 4)}`, name, parentDepartmentId: body.parentDepartmentId?.trim() || null, parentRole: body.parentRole?.trim() || null, description: body.description?.trim() || "" }).returning();
  return Response.json({ department }, { status: 201 });
}
