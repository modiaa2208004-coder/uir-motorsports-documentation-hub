import { eq } from "drizzle-orm";
import { userPositions, users, workflowSettings } from "../../../db/schema";
import { requireApiUser } from "../../auth";
import { ensureOrganization, getDescendantDepartments, organizationPositions } from "../_lib/hierarchy";

export const runtime = "nodejs";

async function database() { const { getDb } = await import("../../../db"); return getDb(); }

export async function GET() {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const db = await database();
  await ensureOrganization(db);
  const [positions, assignments, people, settings] = await Promise.all([organizationPositions(db), db.select().from(userPositions), db.select().from(users), db.select().from(workflowSettings).where(eq(workflowSettings.settingKey, "overdue_escalation_hours")).limit(1)]);
  const peopleById = new Map(people.map((person) => [person.id, person]));
  return Response.json({ overdueEscalationHours: Math.max(1, Number(settings[0]?.settingValue || 24)), positions: positions.map((position) => ({ ...position, parentPosition: position.parentPositionCode ? positions.find((item) => item.code === position.parentPositionCode)?.name ?? position.parentPositionCode : null, descendantDepartments: getDescendantDepartments(position.code), occupants: assignments.filter((assignment) => assignment.positionId === position.id).map((assignment) => peopleById.get(assignment.userId)).filter(Boolean).map((person) => ({ id: person!.id, displayName: person!.displayName, email: person!.email })) })) });
}

export async function PATCH(request: Request) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const isLeader = auth.role === "admin" || auth.role === "Team Leader" || auth.role === "Deputy Team Leader" || auth.roles?.includes("Team Leader") || auth.roles?.includes("Deputy Team Leader");
  if (!isLeader) return Response.json({ error: "Only the team leader or deputy team leader can change organization settings" }, { status: 403 });
  const body = await request.json() as { overdueEscalationHours?: number | string };
  const hours = Number(body.overdueEscalationHours);
  if (!Number.isFinite(hours) || hours < 1 || hours > 8760) return Response.json({ error: "Escalation timing must be between 1 and 8760 hours" }, { status: 400 });
  const db = await database();
  await ensureOrganization(db);
  await db.update(workflowSettings).set({ settingValue: String(Math.round(hours)), updatedByUserId: auth.id, updatedAt: new Date().toISOString() }).where(eq(workflowSettings.settingKey, "overdue_escalation_hours"));
  return Response.json({ overdueEscalationHours: Math.round(hours) });
}
