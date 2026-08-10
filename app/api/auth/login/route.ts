import { createSession, authMode, localLoginUsers, sessionCookieName, sessionTtlSeconds } from "../../../auth";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (authMode() !== "local") return Response.json({ error: "Local sign-in is disabled" }, { status: 403 });

  const payload = (await request.json().catch(() => ({}))) as { userId?: string };
  const user = (await localLoginUsers()).find((item) => item.id === payload.userId);
  if (!user) return Response.json({ error: "Choose a configured local user" }, { status: 400 });

  (await cookies()).set(sessionCookieName(), createSession(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: authMode() !== "local" && process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionTtlSeconds(),
  });
  return Response.json({ user });
}
