import { and, asc, eq, inArray } from "drizzle-orm";
import type { AppUser } from "../../roles";
import { canEdit, userOfficialRoles } from "../../roles";
import { localUsers } from "../../auth";
import type { getDb } from "../../../db";
import {
  approvalSteps,
  approvalWorkflows,
  departments,
  organizationalPositions,
  recordEvents,
  records,
  userDepartments,
  userPositions,
  userRoles,
  users,
  workflowSettings,
} from "../../../db/schema";
import { notifyUsers } from "./workflow-notify";

type WorkflowDb = ReturnType<typeof getDb>;

function parseIds(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value || "[]") as unknown;
    return Array.isArray(parsed) ? [...new Set(parsed.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()))] : [];
  } catch {
    return [] as string[];
  }
}

export const ORGANIZATION_DEPARTMENTS = [
  "Marketing & Media",
  "Finance",
  "Logistics & Procurement",
  "Business Plan",
  "Cost & Manufacturing",
  "Vehicle Mechanics",
  "Chassis & Structures",
  "Powertrain",
  "Electronics & Low Voltage",
  "Simulation, Validation & Testing",
] as const;

export const POSITION_DEFINITIONS = [
  { code: "TEAM_LEADER", name: "Team Leader", positionType: "leader", department: null, branch: "root", parentPositionCode: null },
  { code: "DEPUTY_TEAM_LEADER", name: "Deputy Team Leader", positionType: "leader", department: null, branch: "root", parentPositionCode: "TEAM_LEADER" },
  { code: "OPERATIONS_LEADER", name: "Operations Leader", positionType: "leader", department: null, branch: "operations", parentPositionCode: "TEAM_LEADER" },
  { code: "COMPETITION_LEADER", name: "Competition Leader", positionType: "leader", department: null, branch: "competition", parentPositionCode: "TEAM_LEADER" },
  { code: "STATIC_EVENTS_LEADER", name: "Static Events Leader", positionType: "leader", department: null, branch: "static", parentPositionCode: "COMPETITION_LEADER" },
  { code: "TECHNICAL_DYNAMIC_LEADER", name: "Technical & Dynamic Leader", positionType: "leader", department: null, branch: "technical", parentPositionCode: "COMPETITION_LEADER" },
  { code: "MARKETING_HEAD", name: "Marketing & Media Head", positionType: "department_head", department: "Marketing & Media", branch: "operations", parentPositionCode: "OPERATIONS_LEADER" },
  { code: "FINANCE_HEAD", name: "Finance Head", positionType: "department_head", department: "Finance", branch: "operations", parentPositionCode: "OPERATIONS_LEADER" },
  { code: "LOGISTICS_HEAD", name: "Logistics & Procurement Head", positionType: "department_head", department: "Logistics & Procurement", branch: "operations", parentPositionCode: "OPERATIONS_LEADER" },
  { code: "BUSINESS_PLAN_HEAD", name: "Business Plan Head", positionType: "department_head", department: "Business Plan", branch: "static", parentPositionCode: "STATIC_EVENTS_LEADER" },
  { code: "COST_MANUFACTURING_HEAD", name: "Cost & Manufacturing Head", positionType: "department_head", department: "Cost & Manufacturing", branch: "static", parentPositionCode: "STATIC_EVENTS_LEADER" },
  { code: "VEHICLE_MECHANICS_HEAD", name: "Vehicle Mechanics Head", positionType: "department_head", department: "Vehicle Mechanics", branch: "technical", parentPositionCode: "TECHNICAL_DYNAMIC_LEADER" },
  { code: "CHASSIS_HEAD", name: "Chassis & Structures Head", positionType: "department_head", department: "Chassis & Structures", branch: "technical", parentPositionCode: "TECHNICAL_DYNAMIC_LEADER" },
  { code: "POWERTRAIN_HEAD", name: "Powertrain Head", positionType: "department_head", department: "Powertrain", branch: "technical", parentPositionCode: "TECHNICAL_DYNAMIC_LEADER" },
  { code: "ELECTRONICS_HEAD", name: "Electronics & Low Voltage Head", positionType: "department_head", department: "Electronics & Low Voltage", branch: "technical", parentPositionCode: "TECHNICAL_DYNAMIC_LEADER" },
  { code: "SIMULATION_TEST_HEAD", name: "Simulation, Validation & Test Head", positionType: "department_head", department: "Simulation, Validation & Testing", branch: "technical", parentPositionCode: "TECHNICAL_DYNAMIC_LEADER" },
  { code: "MEMBER", name: "Team Member", positionType: "member", department: null, branch: "root", parentPositionCode: null },
] as const;

const ROLE_TO_POSITION: Record<string, string> = {
  "Team Leader": "TEAM_LEADER",
  "Deputy Team Leader": "DEPUTY_TEAM_LEADER",
  "Operations Leader": "OPERATIONS_LEADER",
  "Competition Leader": "COMPETITION_LEADER",
  "Static Events Leader": "STATIC_EVENTS_LEADER",
  "Technical & Dynamic Leader": "TECHNICAL_DYNAMIC_LEADER",
};

const DEPARTMENT_TO_HEAD = new Map<string, string>(POSITION_DEFINITIONS.filter((item) => item.positionType === "department_head").map((item) => [item.department!, item.code]));
const POSITION_BY_CODE = new Map<string, typeof POSITION_DEFINITIONS[number]>(POSITION_DEFINITIONS.map((item) => [item.code, item]));

export type ResolvedApproval = {
  userId: string;
  userName: string;
  positionCode: string;
  positionName: string;
  department?: string | null;
};

type OrganizationContext = {
  positionRows: Array<typeof organizationalPositions.$inferSelect>;
  users: Map<string, { id: string; displayName: string; email: string; role: string; departments: string[]; roles: string[] }>;
  userPositionCodes: Map<string, string[]>;
  occupants: Map<string, string[]>;
};

export async function ensureOrganization(db: WorkflowDb) {
  const currentDepartments = await db.select().from(departments);
  if (!currentDepartments.length) {
    const departmentSeed = [
      ["operations", "Operations", null, "Operations Leader"],
      ["marketing-media", "Marketing & Media", "operations", "Operations Leader"],
      ["finance", "Finance", "operations", "Operations Leader"],
      ["logistics-procurement", "Logistics & Procurement", "operations", "Operations Leader"],
      ["competition", "Competition", null, "Competition Leader"],
      ["static-events", "Static Events", "competition", "Competition Leader"],
      ["business-plan", "Business Plan", "static-events", "Static Events Leader"],
      ["cost-manufacturing", "Cost & Manufacturing", "static-events", "Static Events Leader"],
      ["technical-dynamic", "Technical & Dynamic", "competition", "Competition Leader"],
      ["vehicle-mechanics", "Vehicle Mechanics", "technical-dynamic", "Technical & Dynamic Leader"],
      ["chassis-structures", "Chassis & Structures", "technical-dynamic", "Technical & Dynamic Leader"],
      ["powertrain", "Powertrain", "technical-dynamic", "Technical & Dynamic Leader"],
      ["electronics-low-voltage", "Electronics & Low Voltage", "technical-dynamic", "Technical & Dynamic Leader"],
      ["simulation-validation-testing", "Simulation, Validation & Testing", "technical-dynamic", "Technical & Dynamic Leader"],
    ] as const;
    await db.insert(departments).values(departmentSeed.map(([id, name, parentDepartmentId, parentRole]) => ({ id, name, parentDepartmentId, parentRole, description: "" }))).onConflictDoNothing();
  }
  await db.insert(organizationalPositions).values(POSITION_DEFINITIONS.map((item) => ({ ...item, id: item.code, positionType: item.positionType as "leader" | "department_head" | "member", active: 1 }))).onConflictDoNothing();
  await db.insert(workflowSettings).values({ id: "overdue-escalation-hours", settingKey: "overdue_escalation_hours", settingValue: "24" }).onConflictDoNothing();
}

async function organizationContext(db: WorkflowDb): Promise<OrganizationContext> {
  await ensureOrganization(db);
  const [positionRows, userRows, departmentRows, roleRows, assignmentRows] = await Promise.all([
    db.select().from(organizationalPositions),
    db.select().from(users),
    db.select().from(userDepartments),
    db.select().from(userRoles),
    db.select().from(userPositions),
  ]);
  const userMap = new Map<string, { id: string; displayName: string; email: string; role: string; departments: string[]; roles: string[] }>();
  for (const user of localUsers()) userMap.set(user.id, { id: user.id, displayName: user.displayName, email: user.email, role: user.role, departments: user.departments ?? [], roles: userOfficialRoles(user) });
  for (const user of userRows) userMap.set(user.id, { id: user.id, displayName: user.displayName, email: user.email, role: user.role, departments: [], roles: [] });
  for (const item of departmentRows) {
    const user = userMap.get(item.userId);
    if (user && !user.departments.includes(item.department)) user.departments.push(item.department);
  }
  for (const item of roleRows) {
    const user = userMap.get(item.userId);
    if (user && !user.roles.includes(item.role)) user.roles.push(item.role);
  }
  const userPositionCodes = new Map<string, string[]>();
  const positionById = new Map(positionRows.map((position) => [position.id, position.code]));
  for (const assignment of assignmentRows) {
    const code = positionById.get(assignment.positionId);
    if (code) userPositionCodes.set(assignment.userId, [...(userPositionCodes.get(assignment.userId) ?? []), code]);
  }
  for (const user of userMap.values()) {
    const legacy = [user.role, ...user.roles].map((role) => ROLE_TO_POSITION[role]).filter(Boolean);
    if (user.role === "admin") legacy.push("TEAM_LEADER");
    if (legacy.length && !(userPositionCodes.get(user.id) ?? []).length) userPositionCodes.set(user.id, [...new Set(legacy)]);
  }
  const occupants = new Map<string, string[]>();
  for (const [userId, codes] of userPositionCodes) for (const code of new Set(codes)) occupants.set(code, [...(occupants.get(code) ?? []), userId]);
  return { positionRows, users: userMap, userPositionCodes, occupants };
}

export async function organizationPositions(db: WorkflowDb) {
  await ensureOrganization(db);
  return db.select().from(organizationalPositions).where(eq(organizationalPositions.active, 1));
}

export function canonicalDepartment(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "simulation, validation & test") return "Simulation, Validation & Testing";
  return value?.trim() ?? "";
}

export async function resolveApprovalChain(db: WorkflowDb, department: string, ownerUserId?: string | null) {
  const context = await organizationContext(db);
  const chainCodes: string[] = [];
  const normalizedDepartment = canonicalDepartment(department);
  const head = DEPARTMENT_TO_HEAD.get(normalizedDepartment);
  if (head) chainCodes.push(head);
  let next = head ? POSITION_BY_CODE.get(head)?.parentPositionCode : null;
  while (next) {
    chainCodes.push(next);
    next = POSITION_BY_CODE.get(next)?.parentPositionCode ?? null;
  }
  if (!chainCodes.length) chainCodes.push("TEAM_LEADER");
  const result: ResolvedApproval[] = [];
  const used = new Set<string>();
  for (const code of chainCodes) {
    const position = POSITION_BY_CODE.get(code);
    for (const userId of context.occupants.get(code) ?? []) {
      if (userId === ownerUserId || used.has(userId)) continue;
      const user = context.users.get(userId);
      if (!user) continue;
      used.add(userId);
      result.push({ userId, userName: user.displayName, positionCode: code, positionName: position?.name ?? code, department: position?.department });
    }
  }
  return result;
}

export async function getManagementChain(db: WorkflowDb, user: AppUser) {
  const context = await organizationContext(db);
  const codes = context.userPositionCodes.get(user.id) ?? [];
  const chainCodes: string[] = [];
  const departmentsForUser = user.departments ?? context.users.get(user.id)?.departments ?? [];
  for (const department of departmentsForUser) {
    const head = DEPARTMENT_TO_HEAD.get(canonicalDepartment(department));
    if (head && !codes.includes(head)) chainCodes.push(head);
  }
  for (const code of codes) {
    let parent = POSITION_BY_CODE.get(code)?.parentPositionCode ?? null;
    while (parent) { chainCodes.push(parent); parent = POSITION_BY_CODE.get(parent)?.parentPositionCode ?? null; }
  }
  const output: Array<{ code: string; name: string; userId?: string | null; userName?: string | null }> = [];
  const seen = new Set<string>();
  for (const code of chainCodes) {
    if (seen.has(code)) continue;
    seen.add(code);
    const position = POSITION_BY_CODE.get(code);
    const occupant = (context.occupants.get(code) ?? []).map((id) => context.users.get(id)).find(Boolean);
    output.push({ code, name: position?.name ?? code, userId: occupant?.id ?? null, userName: occupant?.displayName ?? null });
  }
  return output;
}

export function getDescendantDepartments(positionCode: string) {
  const normalized = positionCode.toUpperCase();
  if (normalized === "TEAM_LEADER" || normalized === "DEPUTY_TEAM_LEADER") return [...ORGANIZATION_DEPARTMENTS];
  if (normalized === "OPERATIONS_LEADER") return ["Marketing & Media", "Finance", "Logistics & Procurement"];
  if (normalized === "COMPETITION_LEADER") return ["Business Plan", "Cost & Manufacturing", "Vehicle Mechanics", "Chassis & Structures", "Powertrain", "Electronics & Low Voltage", "Simulation, Validation & Testing"];
  if (normalized === "STATIC_EVENTS_LEADER") return ["Business Plan", "Cost & Manufacturing"];
  if (normalized === "TECHNICAL_DYNAMIC_LEADER") return ["Vehicle Mechanics", "Chassis & Structures", "Powertrain", "Electronics & Low Voltage", "Simulation, Validation & Testing"];
  const position = POSITION_BY_CODE.get(normalized);
  return position?.department ? [position.department] : [];
}

export function userPositionCodes(user: AppUser) {
  const roles = userOfficialRoles(user);
  const codes = [...roles.map((role) => ROLE_TO_POSITION[role]).filter(Boolean)];
  if (user.role === "admin") codes.push("TEAM_LEADER");
  return [...new Set([...(user.positions ?? []).map((position) => position.code), ...codes])];
}

export function canViewRecord(user: AppUser, record: typeof records.$inferSelect) {
  if (canEdit(user)) return true;
  const assigned = new Set([record.ownerUserId, record.supervisorUserId, ...parseIds(record.responsibleUserIds), ...parseIds(record.approverUserIds), ...parseIds(record.reviewerUserIds), record.reviewerUserId].filter((value): value is string => Boolean(value)));
  if (assigned.has(user.id)) return true;
  const department = canonicalDepartment(record.department);
  if (!department) return true;
  if ((user.departments ?? []).map(canonicalDepartment).includes(department)) return true;
  return userPositionCodes(user).some((code) => getDescendantDepartments(code).includes(department));
}

export function canViewDepartment(user: AppUser, department: string) {
  const normalized = canonicalDepartment(department);
  if (!normalized) return true;
  if (canEdit(user)) return true;
  return (user.departments ?? []).map(canonicalDepartment).includes(normalized) || userPositionCodes(user).some((code) => getDescendantDepartments(code).includes(normalized));
}

export async function canReviewRecord(db: WorkflowDb, user: AppUser, record: typeof records.$inferSelect) {
  if (!canViewRecord(user, record) || !["In review", "Overdue"].includes(record.status)) return false;
  const [workflow] = await db.select().from(approvalWorkflows).where(eq(approvalWorkflows.recordId, record.id)).limit(1);
  if (workflow) {
    const [step] = await db.select().from(approvalSteps).where(and(eq(approvalSteps.workflowId, workflow.id), eq(approvalSteps.status, "Pending"))).orderBy(asc(approvalSteps.stepOrder)).limit(1);
    return Boolean(step?.reviewerUserId === user.id);
  }
  const assigned = parseIds(record.reviewerUserIds);
  return assigned.includes(user.id) || record.reviewerUserId === user.id;
}

export async function canMasterApprove(db: WorkflowDb, user: AppUser, record: typeof records.$inferSelect) {
  if (!canViewRecord(user, record) || !["In review", "Overdue"].includes(record.status)) return false;
  const department = canonicalDepartment(record.department);
  if (!department) return false;
  return userPositionCodes(user).some((code) => getDescendantDepartments(code).includes(department));
}

export async function getNextApprovalStep(db: WorkflowDb, recordId: string) {
  const [workflow] = await db.select().from(approvalWorkflows).where(eq(approvalWorkflows.recordId, recordId)).limit(1);
  if (!workflow) return null;
  const [step] = await db.select().from(approvalSteps).where(and(eq(approvalSteps.workflowId, workflow.id), eq(approvalSteps.status, "Pending"))).orderBy(asc(approvalSteps.stepOrder)).limit(1);
  return step ?? null;
}

export async function refreshOverdueRecords(db: WorkflowDb) {
  const pending = await db.select().from(records).where(inArray(records.status, ["In review", "Overdue"]));
  const [escalationSetting] = await db.select().from(workflowSettings).where(eq(workflowSettings.settingKey, "overdue_escalation_hours")).limit(1);
  const escalationHours = Math.max(1, Number(escalationSetting?.settingValue || 24));
  const now = Date.now();
  const changed: string[] = [];
  for (const record of pending) {
    const due = record.reviewDueAt || record.dueAt;
    const next = await getNextApprovalStep(db, record.id);
    if (!due || Number.isNaN(Date.parse(due)) || Date.parse(due) >= now) continue;
    const chain = await resolveApprovalChainForRecord(db, record);
    const currentIndex = next ? chain.findIndex((item) => item.userId === next.reviewerUserId) : -1;
    const escalationIndex = Math.max(0, currentIndex);
    const overdueAt = record.overdueAt ? Date.parse(record.overdueAt) : now;
    const elapsedHours = Math.max(0, (now - overdueAt) / 3_600_000);
    const escalationLevel = Math.floor(elapsedHours / escalationHours);
    const overdueEvents = await db.select().from(recordEvents).where(and(eq(recordEvents.recordId, record.id), eq(recordEvents.type, "record_overdue"))).orderBy(asc(recordEvents.createdAt));
    const needsStatusUpdate = record.status !== "Overdue";
    if (needsStatusUpdate) {
      await db.update(records).set({ status: "Overdue", overdueAt: record.overdueAt || new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(records.id, record.id));
      changed.push(record.id);
    }
    const notifiedLevels = new Set(overdueEvents.flatMap((event) => { try { const parsed = JSON.parse(event.payloadJson) as { escalationLevel?: unknown }; return typeof parsed.escalationLevel === "number" ? [parsed.escalationLevel] : []; } catch { return []; } }));
    for (let level = 0; level <= escalationLevel; level += 1) {
      if (notifiedLevels.has(level)) continue;
      const escalationTarget = chain[escalationIndex + level + 1] ?? null;
      const notifyIds = [...new Set([next?.reviewerUserId, escalationTarget?.userId].filter((value): value is string => Boolean(value)))];
      await notifyUsers(db, notifyIds, { type: "record_overdue", title: "Document is overdue", message: escalationTarget ? `${record.title} is overdue and has been escalated to ${escalationTarget.positionName}.` : `${record.title} is overdue and awaiting approval.`, recordId: record.id });
      await db.insert(recordEvents).values({ id: crypto.randomUUID(), recordId: record.id, projectId: record.projectId, actorUserId: null, type: "record_overdue", payloadJson: JSON.stringify({ title: record.title, dueAt: due, overdueAt: record.overdueAt || new Date().toISOString(), waitingFor: next?.reviewerUserId ?? null, escalationLevel: level, escalatedTo: escalationTarget?.userId ?? null, escalatedToPosition: escalationTarget?.positionName ?? null, escalationHours }) });
    }
  }
  return changed;
}

export async function resolveApprovalChainForRecord(db: WorkflowDb, record: typeof records.$inferSelect) {
  try {
    const parsed = JSON.parse(record.approvalChainJson || "[]") as ResolvedApproval[];
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch { /* resolve legacy records from the current organization */ }
  return resolveApprovalChain(db, record.department, record.ownerUserId);
}

export async function performMasterApproval(
  db: WorkflowDb,
  user: AppUser,
  record: typeof records.$inferSelect,
  reason: string,
  comment: string,
) {
  if (!reason.trim()) throw new Error("A reason is required for Master Approval.");
  if (record.status === "Approved") throw new Error("This record is already sealed and approved.");
  if (!(await canMasterApprove(db, user, record))) throw new Error("Your organizational position cannot Master Approve this department.");
  if (record.status !== "Overdue" && !comment.trim()) throw new Error("Explain why Master Approval is needed when the document is not overdue.");
  const chain = await resolveApprovalChainForRecord(db, record);
  let [workflow] = await db.select().from(approvalWorkflows).where(eq(approvalWorkflows.recordId, record.id)).limit(1);
  if (!workflow) {
    [workflow] = await db.insert(approvalWorkflows).values({ id: crypto.randomUUID(), recordId: record.id, requiredApprovals: chain.length, completedApprovals: 0, status: "Open" }).returning();
    if (chain.length) await db.insert(approvalSteps).values(chain.map((item, index) => ({ id: crypto.randomUUID(), workflowId: workflow.id, reviewerUserId: item.userId, stepOrder: index + 1, status: "Pending" })));
  }
  let steps = await db.select().from(approvalSteps).where(eq(approvalSteps.workflowId, workflow.id)).orderBy(asc(approvalSteps.stepOrder));
  const chainIndex = chain.findIndex((item) => item.userId === user.id);
  const authorityStepOrder = chainIndex >= 0 ? chainIndex + 1 : steps.length + 1;
  let authorityStep = steps.find((step) => step.reviewerUserId === user.id);
  if (!authorityStep) {
    [authorityStep] = await db.insert(approvalSteps).values({ id: crypto.randomUUID(), workflowId: workflow.id, reviewerUserId: user.id, stepOrder: authorityStepOrder, status: "MASTER_APPROVED" }).returning();
    steps = [...steps, authorityStep].sort((a, b) => a.stepOrder - b.stepOrder);
  } else {
    await db.update(approvalSteps).set({ status: "MASTER_APPROVED", comment: [reason.trim(), comment.trim()].filter(Boolean).join("\n\n"), decidedAt: new Date().toISOString() }).where(eq(approvalSteps.id, authorityStep.id));
  }
  const bypassed = steps.filter((step) => step.stepOrder < authorityStepOrder && step.status === "Pending");
  for (const step of bypassed) await db.update(approvalSteps).set({ status: "BYPASSED", comment: `Bypassed by Master Approval from ${user.displayName}.`, decidedAt: new Date().toISOString() }).where(eq(approvalSteps.id, step.id));
  const pendingAbove = steps.filter((step) => step.stepOrder > authorityStepOrder && step.status === "Pending");
  const nextStatus = pendingAbove.length ? "In review" : "Approved";
  const nextStep = pendingAbove[0] ?? null;
  const nextApprover = nextStep ? chain.find((item) => item.userId === nextStep.reviewerUserId) : null;
  const currentSteps = await db.select().from(approvalSteps).where(eq(approvalSteps.workflowId, workflow.id)).orderBy(asc(approvalSteps.stepOrder));
  await db.update(records).set({ status: nextStatus, masterApproved: 1, masterApprovedByUserId: user.id, masterApprovalReason: reason.trim(), masterApprovalComment: comment.trim(), masterApprovalAt: new Date().toISOString(), reviewerUserId: nextStep?.reviewerUserId || null, reviewer: nextApprover ? `${nextApprover.userName} · ${nextApprover.positionName}` : `${user.displayName} · Master Approved`, reviewerUserIds: JSON.stringify(currentSteps.map((step) => step.reviewerUserId)), updatedAt: new Date().toISOString() }).where(eq(records.id, record.id));
  const completed = currentSteps.filter((step) => ["APPROVED", "MASTER_APPROVED", "BYPASSED"].includes(step.status)).length;
  await db.update(approvalWorkflows).set({ completedApprovals: completed, status: nextStatus === "Approved" ? "Approved" : "Open", updatedAt: new Date().toISOString() }).where(eq(approvalWorkflows.id, workflow.id));
  await db.insert(recordEvents).values({ id: crypto.randomUUID(), recordId: record.id, projectId: record.projectId, actorUserId: user.id, type: "master_approval", payloadJson: JSON.stringify({ event: "MASTER APPROVED", approvedBy: user.displayName, authority: userPositionCodes(user), normalReviewerBypassed: bypassed.map((step) => step.reviewerUserId), reason: reason.trim(), comment: comment.trim(), status: nextStatus, date: new Date().toISOString() }) });
  const chainUserIds = [...bypassed.map((step) => step.reviewerUserId), ...(record.ownerUserId ? [record.ownerUserId] : []), ...(nextStep ? [nextStep.reviewerUserId] : [])];
  await notifyUsers(db, chainUserIds, { type: "master_approval", title: nextStatus === "Approved" ? "Master Approval sealed a document" : "Master Approval advanced a document", message: `${record.title} was Master Approved by ${user.displayName}.`, recordId: record.id });
  const [updated] = await db.select().from(records).where(eq(records.id, record.id)).limit(1);
  return { record: updated, workflow, steps: currentSteps, bypassed, nextStep };
}

export function positionName(code: string) {
  return POSITION_BY_CODE.get(code)?.name ?? code;
}
