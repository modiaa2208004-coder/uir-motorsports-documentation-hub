import { eq } from "drizzle-orm";
import { evidence } from "../../../../db/schema";

async function database() {
  const { getDb } = await import("../../../../db");
  return getDb();
}

async function storage() {
  const { env } = await import("cloudflare:workers");
  return env.BUCKET;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const [item] = await (await database())
    .select()
    .from(evidence)
    .where(eq(evidence.id, id))
    .limit(1);
  if (!item) return new Response("Evidence not found", { status: 404 });

  const object = await (await storage())?.get(item.objectKey);
  if (!object) return new Response("Stored file not found", { status: 404 });

  const safeFilename = item.filename.replace(/["\r\n]/g, "_");
  return new Response(object.body, {
    headers: {
      "content-type": item.contentType,
      "content-length": String(item.size),
      "content-disposition": `attachment; filename="${safeFilename}"`,
    },
  });
}
