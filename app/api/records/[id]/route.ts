import { eq, sql } from "drizzle-orm";
import { records } from "../../../../db/schema";

async function database() {
  const { getDb } = await import("../../../../db");
  return getDb();
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const [record] = await (await database())
    .select()
    .from(records)
    .where(eq(records.id, id))
    .limit(1);

  if (!record) return Response.json({ error: "Record not found" }, { status: 404 });
  return Response.json({ record });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const payload = (await request.json()) as {
      title?: string;
      system?: string;
      reviewer?: string;
      status?: string;
      problem?: string;
      details?: Record<string, string>;
    };

    const detailValues = Object.values(payload.details ?? {});
    const values = [payload.title, payload.system, payload.problem, ...detailValues];
    const completed = values.filter((value) => value?.trim()).length;
    const completeness = Math.max(
      10,
      Math.min(100, Math.round((completed / Math.max(values.length, 1)) * 100)),
    );

    const [record] = await (await database())
      .update(records)
      .set({
        ...(payload.title !== undefined ? { title: payload.title.trim() } : {}),
        ...(payload.system !== undefined ? { system: payload.system.trim() } : {}),
        ...(payload.reviewer !== undefined ? { reviewer: payload.reviewer.trim() } : {}),
        ...(payload.status !== undefined ? { status: payload.status.trim() } : {}),
        ...(payload.problem !== undefined ? { problem: payload.problem.trim() } : {}),
        ...(payload.details !== undefined
          ? { detailsJson: JSON.stringify(payload.details), completeness }
          : {}),
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(records.id, id))
      .returning();

    if (!record) return Response.json({ error: "Record not found" }, { status: 404 });
    return Response.json({ record });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to update record" },
      { status: 500 },
    );
  }
}
