import { eq, inArray } from "drizzle-orm";
import { components, departments, subprojects } from "../../../db/schema";
import { requireApiUser, requireEditor } from "../../auth";

export const runtime = "nodejs";
async function database() { const { getDb } = await import("../../../db"); return getDb(); }

const defaultSubprojects = [
  ["vehicle-mechanics", "Vehicle Mechanics", "vehicle-mechanics"],
  ["chassis-structures", "Chassis & Structures", "chassis-structures"],
  ["powertrain", "Powertrain", "powertrain"],
  ["electronics-low-voltage", "Electronics & Low Voltage", "electronics-low-voltage"],
  ["simulation-validation-testing", "Simulation, Validation & Testing", "simulation-validation-testing"],
  ["business-plan", "Business Plan", "business-plan"],
  ["cost-manufacturing", "Cost & Manufacturing", "cost-manufacturing"],
  ["marketing-media", "Marketing & Media", "marketing-media"],
  ["finance", "Finance", "finance"],
  ["logistics-procurement", "Logistics & Procurement", "logistics-procurement"],
] as const;

async function ensureStructure(db: Awaited<ReturnType<typeof database>>, projectId: string) {
  const deptRows = await db.select().from(departments);
  let subprojectRows = await db.select().from(subprojects).where(eq(subprojects.projectId, projectId));
  if (!subprojectRows.length) {
    const deptMap = new Map(deptRows.map((department) => [department.id, department.id]));
    await db.insert(subprojects).values(defaultSubprojects.map(([code, name, departmentId]) => ({ id: `${projectId}-${code}`, projectId, name, code: code.toUpperCase(), departmentId: deptMap.get(departmentId) ?? departmentId, objective: "", status: "Active" })));
    subprojectRows = await db.select().from(subprojects).where(eq(subprojects.projectId, projectId));
  }
  const componentRows = subprojectRows.length ? await db.select().from(components).where(inArray(components.subprojectId, subprojectRows.map((item) => item.id))) : [];
  return { departments: deptRows, subprojects: subprojectRows.sort((a, b) => a.name.localeCompare(b.name)), components: componentRows };
}

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const projectId = new URL(request.url).searchParams.get("projectId") || "HOPE-2027";
  return Response.json(await ensureStructure(await database(), projectId));
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const denied = requireEditor(auth);
  if (denied) return denied;
  const body = await request.json() as { kind?: "subproject" | "component"; projectId?: string; subprojectId?: string; name?: string; code?: string; departmentId?: string; objective?: string; description?: string };
  if (!body.name?.trim() || !body.code?.trim()) return Response.json({ error: "Name and code are required" }, { status: 400 });
  const db = await database();
  if (body.kind === "component") {
    if (!body.subprojectId) return Response.json({ error: "Choose a sub-project for this component" }, { status: 400 });
    const [component] = await db.insert(components).values({ id: crypto.randomUUID(), subprojectId: body.subprojectId, name: body.name.trim(), code: body.code.trim().toUpperCase(), description: body.description?.trim() || "" }).returning();
    return Response.json({ component }, { status: 201 });
  }
  if (!body.projectId) return Response.json({ error: "Choose a project for this sub-project" }, { status: 400 });
  const [subproject] = await db.insert(subprojects).values({ id: crypto.randomUUID(), projectId: body.projectId, departmentId: body.departmentId?.trim() || null, name: body.name.trim(), code: body.code.trim().toUpperCase(), objective: body.objective?.trim() || "", status: "Active" }).returning();
  return Response.json({ subproject }, { status: 201 });
}
