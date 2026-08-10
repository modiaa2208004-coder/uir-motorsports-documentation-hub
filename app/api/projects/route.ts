import { asc } from "drizzle-orm";
import { projects } from "../../../db/schema";
import { requireApiUser, requireEditor } from "../../auth";

export const runtime = "nodejs";

async function database() {
  const { getDb } = await import("../../../db");
  return getDb();
}

const defaultProject = {
  id: "HOPE-2027",
  name: "HOPE",
  code: "UIR-FS-2027",
  season: "2026–2027",
  competition: "Formula Student UK 2027",
  vehicleClass: "FS Class · Internal Combustion",
  objective:
    "Design, manufacture and validate a simple, low-cost and reliable Formula Student car capable of a realistic top-20 overall result.",
  vehicleSummary:
    "UIR Motorsports’ first running Formula Student car, developed from the 2026 Concept Class programme.",
  status: "Active",
};

export async function GET() {
  try {
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;
    const db = await database();
    let rows = await db.select().from(projects).orderBy(asc(projects.createdAt));

    if (!rows.length) {
      await db.insert(projects).values(defaultProject).onConflictDoNothing();
      rows = await db.select().from(projects).orderBy(asc(projects.createdAt));
    }

    return Response.json({ projects: rows });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to load projects" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser();
    if (auth instanceof Response) return auth;
    const denied = requireEditor(auth);
    if (denied) return denied;
    const payload = (await request.json()) as Partial<typeof defaultProject>;
    const name = payload.name?.trim() ?? "";
    const season = payload.season?.trim() ?? "";
    if (!name || !season) {
      return Response.json({ error: "Project name and season are required" }, { status: 400 });
    }

    const id = `${name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
    const [project] = await (await database())
      .insert(projects)
      .values({
        id,
        name,
        code: payload.code?.trim() || id,
        season,
        competition: payload.competition?.trim() || "Formula Student UK",
        vehicleClass: payload.vehicleClass?.trim() || "FS Class",
        objective: payload.objective?.trim() || "",
        vehicleSummary: payload.vehicleSummary?.trim() || "",
        status: "Active",
      })
      .returning();
    return Response.json({ project }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to create project" },
      { status: 500 },
    );
  }
}
