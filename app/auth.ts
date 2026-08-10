import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { canEdit, isOfficialRole, type AppUser, type AppUserRole, type OfficialRole } from "./roles";

export { canEdit, canManageTeam, isOfficialRole, officialRoles, userHasRole, userOfficialRoles } from "./roles";
export type { AppUser, AppUserRole, OfficialRole } from "./roles";

export function canEditRecord(user: AppUser, ownerUserId: string | null | undefined, reviewerUserId: string | null | undefined) {
  void reviewerUserId;
  return canEdit(user) || user.id === ownerUserId;
}

export function requireEditor(user: AppUser): Response | null {
  return canEdit(user)
    ? null
    : Response.json({ error: "Read-only access: only reviewers and team leaders can edit." }, { status: 403 });
}

const SESSION_COOKIE = "uir_session";
const OAUTH_STATE_COOKIE = "uir_entra_state";
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const OAUTH_STATE_TTL_SECONDS = 10 * 60;

export function authMode() {
  return process.env.AUTH_MODE || (process.env.NODE_ENV === "production" ? "entra" : "local");
}

export function localUsers(): AppUser[] {
  const configured = process.env.LOCAL_AUTH_USERS?.trim();
  if (configured) {
    try {
      const parsed = JSON.parse(configured) as unknown;
      if (Array.isArray(parsed)) {
        const users = parsed.flatMap((value) => {
          if (!value || typeof value !== "object") return [];
          const item = value as Record<string, unknown>;
          const role = item.role;
          const configuredRoles = Array.isArray(item.roles)
            ? item.roles.filter((value): value is OfficialRole => isOfficialRole(value))
            : [];
          if (
            typeof item.id !== "string" ||
            typeof item.displayName !== "string" ||
            typeof item.email !== "string" ||
            !isUserRole(role)
          ) return [];
          return [{ id: item.id, displayName: item.displayName, email: item.email, role, roles: configuredRoles.length ? configuredRoles : fallbackRoles(role) }];
        });
        if (users.length) return users;
      }
    } catch {
      // Fall through to the safe single-user development default.
    }
  }

  return [{
    id: process.env.LOCAL_AUTH_DEFAULT_USER_ID || "local-admin",
    displayName: process.env.LOCAL_AUTH_DISPLAY_NAME || "Mohammed Ismail",
    email: process.env.LOCAL_AUTH_EMAIL || "mohammed.ismail@uir.ma",
    role: parseRole(process.env.LOCAL_AUTH_ROLE) || "admin",
    roles: parseConfiguredRoles(process.env.LOCAL_AUTH_ROLES) ?? ["Team Leader"],
  }];
}

export async function localLoginUsers(): Promise<AppUser[]> {
  const configured = localUsers();
  try {
    const { getDb } = await import("../db");
    const { users, userDepartments, userRoles, organizationalPositions, userPositions } = await import("../db/schema");
    const db = getDb();
    const registered = await db.select().from(users);
    const departments = await db.select().from(userDepartments);
    const assignedRoles = await db.select().from(userRoles);
    const positionRows = await db.select().from(organizationalPositions);
    const positionAssignments = await db.select().from(userPositions);
    const departmentMap = new Map<string, string[]>();
    for (const item of departments) departmentMap.set(item.userId, [...(departmentMap.get(item.userId) ?? []), item.department]);
    const roleMap = new Map<string, OfficialRole[]>();
    for (const item of assignedRoles) {
      if (isOfficialRole(item.role)) roleMap.set(item.userId, [...(roleMap.get(item.userId) ?? []), item.role]);
    }
    const positionMap = new Map(positionRows.map((position) => [position.id, position]));
    const assignedPositions = new Map<string, Array<{ code: string; name: string; positionType: string; department?: string | null }>>();
    for (const assignment of positionAssignments) {
      const position = positionMap.get(assignment.positionId);
      if (!position) continue;
      assignedPositions.set(assignment.userId, [...(assignedPositions.get(assignment.userId) ?? []), { code: position.code, name: position.name, positionType: position.positionType, department: position.department }]);
    }
    const merged = new Map(configured.map((user) => [user.id, user]));
    for (const user of registered) merged.set(user.id, { id: user.id, displayName: user.displayName, email: user.email, role: user.role, roles: roleMap.get(user.id) ?? fallbackRoles(user.role), departments: departmentMap.get(user.id) ?? [], positions: assignedPositions.get(user.id) ?? [] });
    return [...merged.values()];
  } catch {
    return configured;
  }
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (value) return verifySession(value);

  if (authMode() === "chatgpt") {
    const requestHeaders = await headers();
    const email = requestHeaders.get("oai-authenticated-user-email");
    if (!email) return null;
    const encodedName = requestHeaders.get("oai-authenticated-user-full-name");
    const displayName = encodedName && requestHeaders.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8"
      ? decodeName(encodedName)
      : email;
    return { id: `chatgpt:${email}`, displayName, email, role: "admin", roles: ["Team Leader"] };
  }

  return null;
}

export async function requireApiUser(): Promise<AppUser | Response> {
  const user = await getCurrentUser();
  if (user) return user;
  return Response.json({ error: "Authentication required" }, { status: 401 });
}

export function createSession(user: AppUser) {
  const payload = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + SESSION_TTL_SECONDS * 1000 })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function sessionCookieName() {
  return SESSION_COOKIE;
}

export function sessionTtlSeconds() {
  return SESSION_TTL_SECONDS;
}

export function oauthStateCookieName() {
  return OAUTH_STATE_COOKIE;
}

export function oauthStateTtlSeconds() {
  return OAUTH_STATE_TTL_SECONDS;
}

export function createOAuthState(state: string, nonce: string) {
  const payload = Buffer.from(JSON.stringify({ state, nonce, exp: Date.now() + OAUTH_STATE_TTL_SECONDS * 1000 })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyOAuthState(value: string): { state: string; nonce: string } | null {
  const [payload, providedSignature] = value.split(".");
  if (!payload || !providedSignature) return null;
  const expected = signature(payload);
  const provided = Buffer.from(providedSignature);
  const actual = Buffer.from(expected);
  if (provided.length !== actual.length || !timingSafeEqual(provided, actual)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof parsed.state !== "string" || typeof parsed.nonce !== "string" || typeof parsed.exp !== "number" || parsed.exp < Date.now()) return null;
    return { state: parsed.state, nonce: parsed.nonce };
  } catch {
    return null;
  }
}

async function verifySession(value: string): Promise<AppUser | null> {
  const [payload, providedSignature] = value.split(".");
  if (!payload || !providedSignature) return null;
  const expected = signature(payload);
  const provided = Buffer.from(providedSignature);
  const actual = Buffer.from(expected);
  if (provided.length !== actual.length || !timingSafeEqual(provided, actual)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof parsed.exp !== "number" || parsed.exp < Date.now()) return null;
    if (typeof parsed.id !== "string" || typeof parsed.displayName !== "string" || typeof parsed.email !== "string" || !isUserRole(parsed.role)) return null;
    if (authMode() === "local") {
      const matched = (await localLoginUsers()).find((user) => user.id === parsed.id && user.email === parsed.email);
      if (!matched) return null;
      return matched;
    }
    const roles = Array.isArray(parsed.roles) ? parsed.roles.filter((value): value is OfficialRole => isOfficialRole(value)) : [];
    return { id: parsed.id, displayName: parsed.displayName, email: parsed.email, role: parsed.role, roles };
  } catch {
    return null;
  }
}

function signature(payload: string) {
  const secret = process.env.AUTH_SECRET || (process.env.NODE_ENV === "production"
    ? (() => { throw new Error("AUTH_SECRET is required in production"); })()
    : "local-only-development-secret-change-me");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function isUserRole(value: unknown): value is AppUserRole {
  return isOfficialRole(value) || ["admin", "reviewer", "member"].includes(value as string);
}

function parseRole(value: string | undefined): AppUserRole | null {
  return isUserRole(value) ? value : null;
}

function parseConfiguredRoles(value: string | undefined): OfficialRole[] | null {
  if (!value) return null;
  const parsed = value.split(",").map((item) => item.trim()).filter(isOfficialRole);
  return parsed.length ? [...new Set(parsed)] : null;
}

function fallbackRoles(role: unknown): OfficialRole[] {
  return isOfficialRole(role) ? [role] : role === "admin" ? ["Team Leader"] : [];
}

function decodeName(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
