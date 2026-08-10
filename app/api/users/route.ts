import { and, eq, ne } from "drizzle-orm";
import { organizationalPositions, userDepartments, userPositions, userRoles, users } from "../../../db/schema";
import { canEdit, canManageTeam, isOfficialRole, localUsers, officialRoles, requireApiUser } from "../../auth";
import type { OfficialRole } from "../../roles";
import { ensureOrganization, getDescendantDepartments, getManagementChain, organizationPositions, userPositionCodes } from "../_lib/hierarchy";

export const runtime = "nodejs";

async function database() { const { getDb } = await import("../../../db"); return getDb(); }

function assignedRolesFor(user: { id?: string; role?: string; roles?: string[] }, roleRows: Array<{ userId: string; role: string }>): OfficialRole[] {
  const assigned = roleRows.filter((item) => item.userId === user.id && isOfficialRole(item.role)).map((item) => item.role);
  if (assigned.length) return [...new Set(assigned)] as OfficialRole[];
  if (user.roles?.length) return [...new Set(user.roles.filter(isOfficialRole))] as OfficialRole[];
  return isOfficialRole(user.role) ? [user.role] : [];
}

function positionDetails(userId: string, assignments: Array<{ userId: string; positionId: string; department?: string | null }>, positions: Array<typeof organizationalPositions.$inferSelect>, fallbackCodes: string[]) {
  const byId = new Map(positions.map((position) => [position.id, position]));
  const assigned = assignments.filter((item) => item.userId === userId).map((item) => byId.get(item.positionId)).filter(Boolean);
  const fallback = fallbackCodes.map((code) => positions.find((position) => position.code === code)).filter(Boolean);
  return [...new Map([...assigned, ...fallback].map((position) => [position!.code, { code: position!.code, name: position!.name, positionType: position!.positionType, department: position!.department }])).values()];
}

export async function GET() {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const db = await database();
  await ensureOrganization(db);
  const [registered, departmentRows, roleRows, assignmentRows, positionRows] = await Promise.all([
    db.select().from(users),
    db.select().from(userDepartments),
    db.select({ userId: userRoles.userId, role: userRoles.role }).from(userRoles),
    db.select().from(userPositions),
    organizationPositions(db),
  ]);
  const departmentMap = new Map<string, string[]>();
  for (const item of departmentRows) departmentMap.set(item.userId, [...(departmentMap.get(item.userId) ?? []), item.department]);
  const byId = new Map(registered.map((user) => [user.id, user]));
  for (const user of localUsers()) if (!byId.has(user.id)) byId.set(user.id, { ...user, createdAt: "", updatedAt: "" });
  const responseUsers = await Promise.all([...byId.values()].map(async (user) => {
    const departments = departmentMap.get(user.id) ?? [];
    const roles = assignedRolesFor(user, roleRows);
    const fallbackCodes = userPositionCodes({ ...user, roles, departments });
    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      roles,
      departments,
      positions: positionDetails(user.id, assignmentRows, positionRows, fallbackCodes),
      managementChain: await getManagementChain(db, { ...user, roles, departments }),
    };
  }));
  const departmentOptions = [...new Set([...departmentRows.map((row) => row.department), ...positionRows.map((position) => position.department).filter((value): value is string => Boolean(value))])];
  return Response.json({
    roles: [...officialRoles],
    departments: departmentOptions,
    positions: positionRows,
    users: responseUsers,
  });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const body = await request.json() as {
    id?: string;
    displayName?: string;
    email?: string;
    role?: string;
    roles?: string[];
    departments?: string[];
    positions?: string[];
  };
  const accessRole = body.role?.trim();
  const assignedRoles = [...new Set((Array.isArray(body.roles) ? body.roles : isOfficialRole(accessRole) ? [accessRole] : [])
    .map((role) => role.trim()).filter((role) => isOfficialRole(role) || role === "member"))];
  if (!body.id || !body.displayName?.trim() || !body.email?.trim() || !assignedRoles.length) return Response.json({ error: "id, name, email and at least one role are required" }, { status: 400 });
  if (accessRole && !isOfficialRole(accessRole) && !["admin", "member"].includes(accessRole)) return Response.json({ error: "Choose a valid UIR Motorsports role" }, { status: 400 });
  if (accessRole === "reviewer") return Response.json({ error: "Reviewer is assigned to a record; it is not a team role" }, { status: 400 });

  const db = await database();
  await ensureOrganization(db);
  const availablePositions = await organizationPositions(db);
  const positionCodes = [...new Set((body.positions ?? []).map((item) => item.trim()).filter(Boolean))];
  if (positionCodes.some((code) => !availablePositions.some((position) => position.code === code))) return Response.json({ error: "Choose valid organizational positions" }, { status: 400 });
  const departments = [...new Set((body.departments ?? []).map((item) => item.trim()).filter(Boolean))];
  const positionDepartments = availablePositions.filter((position) => positionCodes.includes(position.code) && position.department).map((position) => position.department!);
  const finalDepartments = [...new Set([...departments, ...positionDepartments])];
  const validDepartments = availablePositions.map((position) => position.department).filter((value): value is string => Boolean(value));
  if (finalDepartments.some((department) => !validDepartments.includes(department))) return Response.json({ error: "Choose valid UIR Motorsports departments" }, { status: 400 });

  const canManageAll = canManageTeam(auth);
  const managedDepartments = new Set(userPositionCodes(auth).flatMap((code) => getDescendantDepartments(code)));
  if (!canManageAll && (!canEdit(auth) || !managedDepartments.size)) return Response.json({ error: "Only the team leader or deputy team leader can assign organizational positions" }, { status: 403 });
  const outsideDepartmentScope = finalDepartments.some((department) => !managedDepartments.has(department));
  const outsidePositionScope = positionCodes.some((code) => {
    const department = availablePositions.find((position) => position.code === code)?.department ?? "";
    return Boolean(department) && ![...managedDepartments].includes(department);
  });
  if (!canManageAll && (outsideDepartmentScope || outsidePositionScope)) return Response.json({ error: "You can only assign people inside your organizational scope" }, { status: 403 });
  if (accessRole === "admin" && !canManageAll) return Response.json({ error: "Only the team leader or deputy team leader can grant admin access" }, { status: 403 });

  const primaryRole = accessRole === "admin" || accessRole === "member" ? accessRole : assignedRoles[0];
  const [user] = await db.insert(users).values({ id: body.id, displayName: body.displayName.trim(), email: body.email.trim(), role: primaryRole as never }).onConflictDoUpdate({ target: users.id, set: { displayName: body.displayName.trim(), email: body.email.trim(), role: primaryRole as never, updatedAt: new Date().toISOString() } }).returning();
  await db.delete(userRoles).where(eq(userRoles.userId, body.id));
  await db.insert(userRoles).values(assignedRoles.map((role) => ({ id: crypto.randomUUID(), userId: body.id!, role: role as never })));
  await db.delete(userDepartments).where(eq(userDepartments.userId, body.id));
  if (finalDepartments.length) await db.insert(userDepartments).values(finalDepartments.map((department) => ({ id: crypto.randomUUID(), userId: body.id!, department })));
  for (const code of positionCodes) {
    const position = availablePositions.find((item) => item.code === code);
    if (position) await db.delete(userPositions).where(and(eq(userPositions.positionId, position.id), ne(userPositions.userId, body.id)));
  }
  await db.delete(userPositions).where(eq(userPositions.userId, body.id));
  if (positionCodes.length) await db.insert(userPositions).values(positionCodes.map((code) => ({ id: crypto.randomUUID(), userId: body.id!, positionId: availablePositions.find((position) => position.code === code)!.id, department: availablePositions.find((position) => position.code === code)!.department })));

  const resultUser = { ...user, roles: assignedRoles.filter(isOfficialRole), departments: finalDepartments, positions: positionDetails(user.id, positionCodes.map((code) => ({ userId: user.id, positionId: availablePositions.find((position) => position.code === code)!.id, department: availablePositions.find((position) => position.code === code)!.department })), availablePositions, []) };
  return Response.json({ user: { ...resultUser, managementChain: await getManagementChain(db, resultUser) }, roles: resultUser.roles, departments: finalDepartments });
}
