export const officialRoles = [
  "Team Leader",
  "Deputy Team Leader",
  "Operations Leader",
  "Competition Leader",
  "Static Events Leader",
  "Technical & Dynamic Leader",
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

export type OfficialRole = typeof officialRoles[number];
export type AppUserRole = OfficialRole | "admin" | "reviewer" | "member";

export type AppUser = {
  id: string;
  displayName: string;
  email: string;
  role: AppUserRole;
  /** Assigned engineering/leadership roles. `role` remains for legacy access compatibility. */
  roles?: OfficialRole[];
  departments?: string[];
  positions?: Array<{
    code: string;
    name: string;
    positionType: string;
    department?: string | null;
  }>;
  managementChain?: Array<{
    code: string;
    name: string;
    userId?: string | null;
    userName?: string | null;
  }>;
};

export function isOfficialRole(value: unknown): value is OfficialRole {
  return typeof value === "string" && (officialRoles as readonly string[]).includes(value);
}

export function userHasRole(user: AppUser, role: string) {
  return user.role === role || Boolean(user.roles?.includes(role as OfficialRole));
}

export function userOfficialRoles(user: AppUser): OfficialRole[] {
  const assigned = user.roles?.filter(isOfficialRole) ?? [];
  if (assigned.length) return [...new Set(assigned)];
  return isOfficialRole(user.role) ? [user.role] : user.role === "admin" ? ["Team Leader"] : [];
}

/** Team leaders and deputies may mutate shared project data. */
export function canEdit(user: AppUser) {
  return userHasRole(user, "admin") || userHasRole(user, "Team Leader") || userHasRole(user, "Deputy Team Leader");
}

export function canManageTeam(user: AppUser) {
  return canEdit(user);
}
