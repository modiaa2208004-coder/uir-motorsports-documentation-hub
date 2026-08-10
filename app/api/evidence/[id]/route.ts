import { eq } from "drizzle-orm";
import { evidence } from "../../../../db/schema";
import { requireApiUser } from "../../../auth";
import { getEvidenceStorage } from "../../_lib/evidenceStorage";

export const runtime = "nodejs";

async function database() {
  const { getDb } = await import("../../../../db");
  return getDb();
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if (auth instanceof Response) return auth;
  const { id } = await context.params;
  const [item] = await (await database())
    .select()
    .from(evidence)
    .where(eq(evidence.id, id))
    .limit(1);
  if (!item || item.deletedAt) return new Response("Evidence not found", { status: 404 });

  const object = await getEvidenceStorage().get(item.objectKey);
  if (!object) return new Response("Stored file not found", { status: 404 });

  const safeFilename = item.filename.replace(/["\r\n]/g, "_");
  return new Response(object.body, {
    headers: {
      "content-type": item.contentType,
      "content-length": String(object.size ?? item.size),
      "content-disposition": `inline; filename="${safeFilename}"`,
    },
  });
}
