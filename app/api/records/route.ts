import { desc } from "drizzle-orm";
import { records } from "../../../db/schema";

async function database() {
  const { getDb } = await import("../../../db");
  return getDb();
}

export async function GET() {
  try {
    const rows = await (await database())
      .select()
      .from(records)
      .orderBy(desc(records.updatedAt))
      .limit(100);

    return Response.json({ records: rows });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to load records" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      projectId?: string;
      title?: string;
      type?: string;
      system?: string;
      owner?: string;
      reviewer?: string;
      problem?: string;
      details?: Record<string, string>;
      status?: string;
    };
    const projectId = payload.projectId?.trim() || "HOPE-2027";
    const title = payload.title?.trim() ?? "";
    const type = payload.type?.trim() ?? "";
    const system = payload.system?.trim() ?? "";

    if (!title || !type || !system) {
      return Response.json(
        { error: "title, type and system are required" },
        { status: 400 }
      );
    }

    const id = `REC-2027-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const [record] = await (await database())
      .insert(records)
      .values({
        id,
        projectId,
        title,
        type,
        system,
        problem: payload.problem?.trim() ?? "",
        owner: payload.owner?.trim() || "Mohammed Ismail",
        reviewer: payload.reviewer?.trim() || "Department Leader",
        status: payload.status?.trim() || "Draft",
        detailsJson: JSON.stringify(payload.details ?? {}),
        completeness: calculateCompleteness(payload),
      })
      .returning();

    return Response.json({ record }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to save record" },
      { status: 500 }
    );
  }
}

function calculateCompleteness(payload: {
  title?: string;
  type?: string;
  system?: string;
  problem?: string;
  details?: Record<string, string>;
}) {
  const values = [
    payload.title,
    payload.type,
    payload.system,
    payload.problem,
    ...Object.values(payload.details ?? {}),
  ];
  const completed = values.filter((value) => value?.trim()).length;
  return Math.max(10, Math.min(95, Math.round((completed / Math.max(values.length, 1)) * 100)));
}
