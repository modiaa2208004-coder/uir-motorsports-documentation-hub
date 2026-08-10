import { and, desc, eq, isNull } from "drizzle-orm";
import { notifications } from "../../../db/schema";
import { requireApiUser } from "../../auth";

export const runtime = "nodejs";
async function database() { const { getDb } = await import("../../../db"); return getDb(); }

export async function GET() {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const db = await database();
  const [items, unread] = await Promise.all([
    db.select().from(notifications).where(eq(notifications.userId, auth.id)).orderBy(desc(notifications.createdAt)).limit(100),
    db.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.userId, auth.id), isNull(notifications.readAt))),
  ]);
  return Response.json({ notifications: items, unreadCount: unread.length });
}

export async function PATCH(request: Request) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const body = await request.json() as { id?: string; all?: boolean };
  const db = await database();
  if (body.all) await db.update(notifications).set({ readAt: new Date().toISOString() }).where(eq(notifications.userId, auth.id));
  else if (body.id) await db.update(notifications).set({ readAt: new Date().toISOString() }).where(and(eq(notifications.id, body.id), eq(notifications.userId, auth.id)));
  else return Response.json({ error: "Notification id or all is required" }, { status: 400 });
  return Response.json({ ok: true });
}
