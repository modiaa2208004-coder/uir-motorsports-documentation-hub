import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { authMode, createSession, isOfficialRole, oauthStateCookieName, sessionCookieName, sessionTtlSeconds, verifyOAuthState, type AppUser } from "../../../../auth";
import { entraClient, entraScopes, roleForClaims } from "../_lib";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (authMode() !== "entra") return Response.redirect(new URL("/login", request.url));
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) return redirectWithError(request, url.searchParams.get("error_description") || error);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stateCookie = (await cookies()).get(oauthStateCookieName())?.value;
  const expected = stateCookie ? verifyOAuthState(stateCookie) : null;
  if (!code || !state || !expected || expected.state !== state) return redirectWithError(request, "The Entra sign-in state was invalid or expired.");

  try {
    const { client, config } = entraClient();
    const result = await client.acquireTokenByCode({ code, scopes: entraScopes(), redirectUri: config.redirectUri });
    const claims = (result?.idTokenClaims || {}) as Record<string, unknown>;
    if (claims.nonce !== expected.nonce) return redirectWithError(request, "The Entra sign-in nonce was invalid.");
    const claimRole = roleForClaims(claims);
    if (!claimRole) return redirectWithError(request, "Your account is not a member of an allowed UIR Motorsports group.");
    const userId = String(claims.oid || claims.sub || "");
    const { getDb } = await import("../../../../../db");
    const { userRoles, users } = await import("../../../../../db/schema");
    const db = getDb();
    const [registeredUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const assignedRole = registeredUser && registeredUser.role !== "member" ? registeredUser.role : claimRole;
    const roleRows = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId));
    const assignedRoles = [...new Set(roleRows.map((item) => item.role).filter(isOfficialRole))];
    if (!assignedRoles.length && registeredUser && isOfficialRole(registeredUser.role)) assignedRoles.push(registeredUser.role);

    const user: AppUser = {
      id: userId,
      displayName: String(claims.name || claims.preferred_username || "Entra user"),
      email: String(claims.preferred_username || claims.email || ""),
      role: assignedRole,
      roles: assignedRoles,
    };
    if (!user.id || !user.email) return redirectWithError(request, "The Entra identity did not include a usable user id and email.");

    await db.insert(users).values({ id: user.id, displayName: user.displayName, email: user.email, role: user.role }).onConflictDoUpdate({
      target: users.id,
      set: { displayName: user.displayName, email: user.email, role: user.role, updatedAt: new Date().toISOString() },
    });
    (await cookies()).set(sessionCookieName(), createSession(user), {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: sessionTtlSeconds(),
    });
    (await cookies()).set(oauthStateCookieName(), "", { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 0 });
    return Response.redirect(new URL("/", request.url));
  } catch (caught) {
    return redirectWithError(request, caught instanceof Error ? caught.message : "Entra sign-in failed.");
  }
}

function redirectWithError(request: Request, message: string) {
  return Response.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, request.url));
}
