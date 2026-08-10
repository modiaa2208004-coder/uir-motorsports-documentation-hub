import { eq, sql } from "drizzle-orm";
import { projects } from "../../../../db/schema";
import { requireApiUser, requireEditor } from "../../../auth";

export const runtime = "nodejs";

async function database() {
  const { getDb } = await import("../../../../db");
  return getDb();
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const denied = requireEditor(auth);
  if (denied) return denied;
    const { id } = await context.params;
    const payload = (await request.json()) as {
      name?: string;
      code?: string;
      season?: string;
      competition?: string;
      vehicleClass?: string;
      objective?: string;
      vehicleSummary?: string;
      status?: string;
    };

    const [project] = await (await database())
      .update(projects)
      .set({
        ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
        ...(payload.code !== undefined ? { code: payload.code.trim() } : {}),
        ...(payload.season !== undefined ? { season: payload.season.trim() } : {}),
        ...(payload.competition !== undefined ? { competition: payload.competition.trim() } : {}),
        ...(payload.vehicleClass !== undefined ? { vehicleClass: payload.vehicleClass.trim() } : {}),
        ...(payload.objective !== undefined ? { objective: payload.objective.trim() } : {}),
        ...(payload.vehicleSummary !== undefined
          ? { vehicleSummary: payload.vehicleSummary.trim() }
          : {}),
        ...(payload.status !== undefined ? { status: payload.status.trim() } : {}),
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(projects.id, id))
      .returning();

    if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
    return Response.json({ project });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to update project" },
      { status: 500 },
    );
  }
}
