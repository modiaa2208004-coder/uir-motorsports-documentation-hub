import { eq } from "drizzle-orm";
import type { AppUser } from "../../roles";
import { records, userDepartments, users } from "../../../db/schema";
import type { getDb } from "../../../db";
import {
  canMasterApprove,
  canReviewRecord,
  canViewRecord,
  canViewDepartment,
  canonicalDepartment,
  ensureOrganization,
  getDescendantDepartments,
  getManagementChain,
  getNextApprovalStep,
  organizationPositions,
  positionName,
  refreshOverdueRecords,
  resolveApprovalChain,
  resolveApprovalChainForRecord,
  userPositionCodes,
} from "./hierarchy";
import { notifyUsers } from "./workflow-notify";

export {
  canMasterApprove,
  canReviewRecord,
  canViewRecord,
  canViewDepartment,
  canonicalDepartment,
  ensureOrganization,
  getDescendantDepartments,
  getManagementChain,
  getNextApprovalStep,
  organizationPositions,
  positionName,
  refreshOverdueRecords,
  resolveApprovalChain,
  resolveApprovalChainForRecord,
  userPositionCodes,
  notifyUsers,
};

export function parseIds(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value || "[]") as unknown;
    return Array.isArray(parsed)
      ? [...new Set(parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()))]
      : [];
  } catch {
    return [];
  }
}

export function isOrganizationLeader(user: AppUser) {
  return userPositionCodes(user).some((code) => code !== "MEMBER");
}

export async function userIdsForDepartment(db: ReturnType<typeof getDb>, department: string) {
  if (!department) return [] as string[];
  const rows = await db.select({ userId: userDepartments.userId }).from(userDepartments).where(eq(userDepartments.department, department));
  return rows.map((row: { userId: string }) => row.userId);
}

export async function registeredUserIds(db: ReturnType<typeof getDb>) {
  const rows = await db.select({ id: users.id }).from(users);
  return new Set(rows.map((row: { id: string }) => row.id));
}

export function parseDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return null;
  return value;
}

export function priority(value: unknown) {
  return value === "Low" || value === "High" || value === "Critical" ? value : "Normal";
}

export type WorkflowDb = ReturnType<typeof getDb>;
export type RecordRow = typeof records.$inferSelect;
