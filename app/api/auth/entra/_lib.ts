import { ConfidentialClientApplication } from "@azure/msal-node";

const scopes = ["openid", "profile", "email"];

export function entraConfig() {
  const tenantId = process.env.ENTRA_TENANT_ID;
  const clientId = process.env.ENTRA_CLIENT_ID;
  const clientSecret = process.env.ENTRA_CLIENT_SECRET;
  const redirectUri = process.env.ENTRA_REDIRECT_URI;
  if (!tenantId || !clientId || !clientSecret || !redirectUri) {
    throw new Error("ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET and ENTRA_REDIRECT_URI are required");
  }
  return { tenantId, clientId, clientSecret, redirectUri };
}

export function entraClient() {
  const config = entraConfig();
  return {
    config,
    client: new ConfidentialClientApplication({
      auth: {
        clientId: config.clientId,
        authority: `https://login.microsoftonline.com/${config.tenantId}`,
        clientSecret: config.clientSecret,
      },
    }),
  };
}

export function entraScopes() {
  return scopes;
}

export function roleForClaims(claims: Record<string, unknown>) {
  const groups = Array.isArray(claims.groups) ? claims.groups.filter((value): value is string => typeof value === "string") : [];
  const roles = Array.isArray(claims.roles) ? claims.roles.filter((value): value is string => typeof value === "string") : [];
  const allowedGroups = csvEnv("ENTRA_ALLOWED_GROUP_IDS");
  if (!allowedGroups.length || !groups.some((group) => allowedGroups.includes(group))) return null;

  const adminGroups = csvEnv("ENTRA_ADMIN_GROUP_IDS");
  const reviewerGroups = csvEnv("ENTRA_REVIEWER_GROUP_IDS");
  if (groups.some((group) => adminGroups.includes(group)) || roles.includes("admin")) return "admin" as const;
  if (groups.some((group) => reviewerGroups.includes(group)) || roles.includes("reviewer")) return "reviewer" as const;
  return "member" as const;
}

export function csvEnv(name: string) {
  return (process.env[name] || "").split(",").map((value) => value.trim()).filter(Boolean);
}
